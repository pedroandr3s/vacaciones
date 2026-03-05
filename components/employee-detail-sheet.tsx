"use client"

import React, { useState, useRef } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { EmployeeWithBalance, ContractFile } from "@/lib/types"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Badge } from "@/components/ui/badge"
import { Calendar, Lock, AlertTriangle, FileText, Power, Briefcase, History, CalendarPlus, Clock, Info, User, Cake, Pencil, X, Check, Loader2, CalendarOff, RefreshCw, CheckCircle2, Upload, Download, Trash2, Paperclip, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useData } from "@/contexts/data-context"
import { RegisterVacationDialog } from "@/components/register-vacation-dialog"
import { AdminRegisterUnpaidLeaveDialog } from "@/components/admin-register-unpaid-leave-dialog"
import {
  getTotalAvailable,
  calculateSeniority,
  isNaitusUnlocked,
  isNaitusExpired,
  getMonthsUntilNaitusExpires,
  getEffectiveNaitusDays,
  isBenefitUnlocked,
  isBenefitExpired,
  getEffectiveBenefitDays,
  getMonthsUntilBenefitExpires,
  calculateContractorCycle,
  parseLocalDate,
  getEffectiveLegalDays,
} from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  employee: EmployeeWithBalance | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onVacationRegistered?: () => void
}

export function EmployeeDetailSheet({ employee, open, onOpenChange, onVacationRegistered }: Props) {
  const { requests, contracts, employees, updateEmployee, updateContract } = useData()
  const [employeeStatus, setEmployeeStatus] = useState<"activo" | "inactivo">(employee?.status || "activo")
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [unpaidLeaveDialogOpen, setUnpaidLeaveDialogOpen] = useState(false)
  const [uploadingContractId, setUploadingContractId] = useState<string | null>(null)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleFileUpload = async (contractId: string, file: File) => {
    if (file.size > 10_000_000) {
      alert("El archivo es demasiado grande. Máximo 10MB.")
      return
    }
    setUploadingContractId(contractId)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Extraer solo la parte base64 sin el prefijo data:...
          const base64Only = result.split(",")[1] || result
          resolve(base64Only)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const employeeName = employee?.fullName || "Sin nombre"
      const payload = {
        fileName: file.name,
        fileBase64: base64,
        employeeName,
        contractId,
        rut: employee?.rut || "",
      }

      const res = await fetch("/api/webhook/anexo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await res.json()

      if (!result.success) {
        alert(result.message || "Error al enviar el archivo.")
        return
      }

      // n8n devuelve un array, extraer el primer elemento
      const raw = result.data
      const driveData = Array.isArray(raw) ? raw[0] : raw
      const driveFileId = driveData?.fileId || driveData?.id || ""
      const driveUrl = driveData?.fileUrl || driveData?.webViewLink || ""

      if (!driveUrl) {
        alert("No se recibió la URL de Google Drive. El archivo no fue guardado.")
        return
      }

      const fileId = `${contractId}_${Date.now()}`
      const contract = contracts.find((c) => c.id === contractId)
      const existingFiles: ContractFile[] = contract?.files || []
      const newFile: ContractFile = {
        name: file.name,
        url: driveUrl,
        path: fileId,
        driveFileId,
        uploadedAt: new Date().toISOString(),
      }

      await updateContract(contractId, {
        files: [...existingFiles, newFile],
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error("Error uploading file:", err)
      alert("Error al subir el archivo. Intente nuevamente.")
    } finally {
      setUploadingContractId(null)
    }
  }

  const handleFileDelete = async (contractId: string, filePath: string) => {
    setDeletingFile(filePath)
    try {
      const contract = contracts.find((c) => c.id === contractId)
      const updatedFiles = (contract?.files || []).filter((f) => f.path !== filePath)

      await updateContract(contractId, {
        files: updatedFiles,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error("Error deleting file:", err)
    } finally {
      setDeletingFile(null)
    }
  }
  
  // Personal info edit state
  const [isEditingPersonal, setIsEditingPersonal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [editFormData, setEditFormData] = useState({
    fullName: employee?.fullName || "",
    email: employee?.email || "",
    rut: employee?.rut || "",
    birthDate: employee?.birthDate || "",
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Position edit state (for Contract tab)
  const [isEditingPosition, setIsEditingPosition] = useState(false)
  const [isSavingPosition, setIsSavingPosition] = useState(false)
  const [positionSaveSuccess, setPositionSaveSuccess] = useState(false)
  const [positionSaveError, setPositionSaveError] = useState("")
  const [editPosition, setEditPosition] = useState(employee?.position || "")
  const [positionValidationError, setPositionValidationError] = useState("")

  // Reset form when employee changes or dialog opens
  React.useEffect(() => {
    if (employee) {
      setEditFormData({
        fullName: employee.fullName,
        email: employee.email,
        rut: employee.rut,
        birthDate: employee.birthDate || "",
      })
      setIsEditingPersonal(false)
      setValidationErrors({})
      setSaveSuccess(false)
      setSaveError("")
      // Sync status
      setEmployeeStatus(employee.status || "activo")
      // Reset position edit state
      setEditPosition(employee.position || "")
      setIsEditingPosition(false)
      setPositionSaveSuccess(false)
      setPositionSaveError("")
      setPositionValidationError("")
    }
  }, [employee, open])

  const balance = employee?.balance
  const contractType = employee?.contractType || "chile"
  
  // Get contracts for this collaborator
  const collaboratorContracts = contracts
    .filter((c) => c.collaboratorId === employee?.id)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

  // Check if collaborator is currently on vacation
  const currentVacation = requests.find(
    (r) => 
      r.employeeId === employee?.id && 
      r.status === "approved" &&
      new Date(r.startDate) <= new Date() &&
      new Date(r.endDate) >= new Date()
  )
  
  const isOnVacation = !!currentVacation
  const isInactive = employeeStatus === "inactivo" || employee?.status === "inactivo"

  // Contractor cycle info
  const isContractor = contractType === "contractor_extranjero"
  const contractorCycle = isContractor && employee ? calculateContractorCycle(employee.hireDate) : null
  const contractorActivated = contractorCycle?.hasCompletedFirstYear ?? false

  // Calcular estado de Días Naitus
  // Para contractors: Naitus siempre disponibles (sin condición de 15 días usados)
  const naitusUnlocked = balance ? isNaitusUnlocked(balance, contractType as "chile" | "contractor_extranjero") : false
  const naitusExpired = balance ? isNaitusExpired(balance.naitusDays) : false
  const effectiveNaitusDays = balance ? getEffectiveNaitusDays(balance, contractType as "chile" | "contractor_extranjero") : 0
  // Los días Naitus vencen a fin de año para TODOS los tipos de contrato (no son acumulables)
  const monthsUntilExpiry = isContractor && contractorCycle
    ? Math.max(0, Math.ceil((contractorCycle.nextRenewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : getMonthsUntilNaitusExpires()

  // Días legales calculados dinámicamente desde hireDate
  const computedLegalDays = employee
    ? getEffectiveLegalDays(employee.hireDate, contractType as "chile" | "contractor_extranjero", balance?.legalDays || 0)
    : (balance?.legalDays || 0)
  const availableLegalDays = Math.max(0, computedLegalDays - (balance?.usedDays || 0))
  const displayNaitusDays = effectiveNaitusDays // respeta unlock/expired

  const totalAvailable = balance
    ? getTotalAvailable(computedLegalDays, balance.naitusDays, balance.usedDays, balance.debtDays, contractType as "chile" | "contractor_extranjero")
    : 0

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateRut = (rut: string): boolean => {
    // Basic RUT validation (Chilean format or international ID)
    if (!rut || rut.length < 3) return false
    return true
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!editFormData.fullName.trim()) {
      errors.fullName = "El nombre es requerido"
    } else if (editFormData.fullName.trim().length < 3) {
      errors.fullName = "El nombre debe tener al menos 3 caracteres"
    }
    
    if (!editFormData.email.trim()) {
      errors.email = "El correo es requerido"
    } else if (!validateEmail(editFormData.email)) {
      errors.email = "Formato de correo inválido"
    }
    
    if (!editFormData.rut.trim()) {
      errors.rut = "El RUT/ID es requerido"
    } else if (!validateRut(editFormData.rut)) {
      errors.rut = "Formato de RUT/ID inválido"
    }
    
    if (editFormData.birthDate) {
      const birthDate = new Date(editFormData.birthDate)
      const today = new Date()
      if (birthDate > today) {
        errors.birthDate = "La fecha no puede ser futura"
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSavePersonalInfo = async () => {
    if (!validateForm()) return
    
    setIsSaving(true)
    setSaveError("")
    setSaveSuccess(false)
    
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          fullName: editFormData.fullName,
          email: editFormData.email,
          rut: editFormData.rut,
          birthDate: editFormData.birthDate || undefined,
          updatedAt: new Date().toISOString(),
        })
      }
      
      setSaveSuccess(true)
      setIsEditingPersonal(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError("Error al guardar los cambios. Intenta nuevamente.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditFormData({
      fullName: employee?.fullName || "",
      email: employee?.email || "",
      rut: employee?.rut || "",
      birthDate: employee?.birthDate || "",
    })
    setValidationErrors({})
    setIsEditingPersonal(false)
  }

  // Position save handler
  const handleSavePosition = async () => {
    // Validate position
    if (!editPosition.trim()) {
      setPositionValidationError("El cargo es requerido")
      return
    }
    if (editPosition.trim().length < 2) {
      setPositionValidationError("El cargo debe tener al menos 2 caracteres")
      return
    }
    
    setPositionValidationError("")
    setIsSavingPosition(true)
    setPositionSaveError("")
    setPositionSaveSuccess(false)
    
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          position: editPosition.trim(),
          updatedAt: new Date().toISOString(),
        })
      }
      
      setPositionSaveSuccess(true)
      setIsEditingPosition(false)
      
      // Clear success message after 3 seconds
      setTimeout(() => setPositionSaveSuccess(false), 3000)
    } catch {
      setPositionSaveError("Error al guardar el cargo. Intenta nuevamente.")
    } finally {
      setIsSavingPosition(false)
    }
  }

  const handleCancelPositionEdit = () => {
    setEditPosition(employee?.position || "")
    setPositionValidationError("")
    setIsEditingPosition(false)
  }

  if (!employee) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto px-4 bg-background">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-2xl">{employee.fullName}</SheetTitle>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
              {employee.position && (
                <p className="text-xs text-slate-500 mt-1">{employee.position}</p>
              )}
            </div>
          </div>
          
          {/* Status Indicator Card */}
          <Card className={`mt-[px] ${isInactive ? "bg-red-50 border-red-200" : isOnVacation ? "bg-emerald-50 border-emerald-200" : "bg-green-50 border-green-200"}`}>
            <CardContent className="p-3 px-3 py-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isInactive ? "bg-red-500" : isOnVacation ? "bg-emerald-500 animate-pulse" : "bg-green-500"}`} />
                  <div>
                    <p className={`text-sm font-medium ${isInactive ? "text-red-700" : isOnVacation ? "text-emerald-700" : "text-green-700"}`}>
                      Estado: {isInactive ? "Inactivo" : "Activo"}
                      {isOnVacation && !isInactive && (currentVacation?.absenceType === "permiso_sin_goce" ? " / Permiso sin Goce" : " / En Vacaciones")}
                    </p>
                    {isInactive && employee.statusReason && (
                      <p className="text-xs text-red-600">
                        Motivo: {employee.statusReason}
                        {employee.statusEndDate && ` (${parseLocalDate(employee.statusEndDate).toLocaleDateString("es-CL")})`}
                      </p>
                    )}
                    {isOnVacation && currentVacation && !isInactive && (
                      <p className="text-xs text-emerald-600">
                        Desde {new Date(currentVacation.startDate).toLocaleDateString("es-CL")} hasta {new Date(currentVacation.endDate).toLocaleDateString("es-CL")}
                      </p>
                    )}
                  </div>
                </div>
                {isInactive && (
                  <Badge variant="destructive" className="text-xs">
                    No puede solicitar días
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </SheetHeader>

        <Tabs defaultValue="summary" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="personal" className="text-xs sm:text-sm">
              <User className="h-4 w-4 mr-1 hidden sm:inline" />
              Ficha
            </TabsTrigger>
            <TabsTrigger value="contract" className="text-xs sm:text-sm">
              <Briefcase className="h-4 w-4 mr-1 hidden sm:inline" />
              Contrato
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Resumen y Solicitud */}
          <TabsContent value="summary" className="space-y-6 mt-6">
            {/* Estado de Cuentas - Diferenciado por tipo de contrato */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Estado de Cuentas</h3>
                <Badge 
                  variant="outline" 
                  className={contractType === "contractor_extranjero" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}
                >
                  {contractType === "contractor_extranjero" ? "Contractor en el extranjero" : "Contrato en Chile"}
                </Badge>
              </div>

              {/* Alerta informativa sobre acumulación - colapsable */}
              <Collapsible defaultOpen={false} className="group mb-4">
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                      isContractor
                        ? "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                        : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Info className={`h-4 w-4 ${isContractor ? "text-purple-600" : "text-blue-600"}`} />
                      <span>
                        {isContractor
                          ? "Informacion sobre Contractor en el extranjero"
                          : "Informacion sobre Contrato en Chile"}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Alert className={`mt-2 ${isContractor ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}`}>
                    <Info className={`h-4 w-4 ${isContractor ? "text-purple-600" : "text-blue-600"}`} />
                    <AlertDescription className={`text-xs ${isContractor ? "text-purple-700" : "text-blue-700"}`}>
                      {isContractor ? (
                        <>
                          <strong>Contractor en el extranjero:</strong> Los 15 dias legales y 5 dias Naitus se activan al cumplir 1 ano desde el inicio del contrato.
                          <br />
                          <strong>Dias Naitus:</strong> Siempre disponibles sin condiciones. El sistema descuenta primero los dias legales y solo cuando se agotan, descuenta de los Naitus.
                          <br />
                          <strong>Renovacion:</strong> Al completar cada ciclo anual, los dias se renuevan (no se acumulan).
                          {contractorCycle && (
                            <>
                              <br />
                              <strong>Estado:</strong>{" "}
                              {contractorActivated
                                ? `Ciclo ${contractorCycle.currentCycleNumber} activo. Proxima renovacion: ${contractorCycle.nextRenewalDate.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}`
                                : `Pendiente de activacion. Faltan ${contractorCycle.daysUntilActivation} dias para cumplir 1 ano.`}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <strong>Dias Legales:</strong> Se acumulan desde el inicio del contrato y no se reinician.
                          <br />
                          <strong>Dias Naitus:</strong> 5 dias adicionales que NO son acumulables. Vencen el 31 de diciembre.
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>

              {/* Contractor cycle progress bar */}
              {isContractor && contractorCycle && (
                <Card className={`mb-4 ${contractorActivated ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {contractorActivated ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-600" />
                      )}
                      <p className={`text-sm font-medium ${contractorActivated ? "text-green-700" : "text-amber-700"}`}>
                        {contractorActivated
                          ? `Ciclo ${contractorCycle.currentCycleNumber} - Licencias activas`
                          : "Licencias pendientes de activacion"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={contractorActivated ? "text-green-600" : "text-amber-600"}>
                          {contractorActivated ? "Progreso del ciclo" : "Progreso hacia activacion"}
                        </span>
                        <span className={`font-medium ${contractorActivated ? "text-green-700" : "text-amber-700"}`}>
                          {contractorCycle.progressPercent}%
                        </span>
                      </div>
                      <div className={`w-full rounded-full h-2 ${contractorActivated ? "bg-green-100" : "bg-amber-100"}`}>
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${contractorActivated ? "bg-green-500" : "bg-amber-500"}`}
                          style={{ width: `${contractorCycle.progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          {contractorCycle.currentCycleStartDate.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          {contractorCycle.nextRenewalDate.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resumen de Días Legales - Desglose claro */}
              <Card className="mb-4 border-slate-200">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Días Legales
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-4">
                    {/* Días Acumulados */}
                    <div className="text-center p-3 bg-slate-50 rounded-lg border">
                      <p className="text-xs text-slate-500 mb-1">Días Acumulados</p>
                      <p className="text-2xl font-bold text-slate-800">{computedLegalDays.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isContractor
                          ? contractorActivated ? "Por ciclo anual" : "Pendiente"
                          : "Desde inicio contrato"}
                      </p>
                    </div>
                    {/* Días Tomados */}
                    <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-xs text-amber-600 mb-1">Días Tomados</p>
                      <p className="text-2xl font-bold text-amber-700">{(balance?.usedDays || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-amber-500 mt-1">Ya utilizados</p>
                    </div>
                    {/* Saldo Disponible */}
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600 mb-1">Saldo Disponible</p>
                      <p className="text-2xl font-bold text-blue-700">{availableLegalDays.toFixed(2)}</p>
                      <p className="text-[10px] text-blue-500 mt-1">Para solicitar</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cards de Naitus y Deuda */}
              <div className="grid grid-cols-2 gap-3">
                {/* Card Días Naitus */}
                <Card className={`${naitusUnlocked ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                  <CardContent className="p-4 relative text-left">
                    <p className={`font-medium mb-1 text-sm ${naitusUnlocked ? "text-green-700" : "text-amber-700"}`}>
                      Días Naitus
                    </p>
                    <p className={`text-3xl font-bold ${naitusUnlocked ? "text-green-900" : "text-amber-900"}`}>
                      {displayNaitusDays.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {isContractor && contractorCycle
                        ? contractorActivated
                          ? `Disponibles. Renov: ${contractorCycle.nextRenewalDate.toLocaleDateString("es-CL", { day: "numeric", month: "short" })}. Prioridad: legales primero`
                          : `Se activan al cumplir 1 ano`
                        : "Vencen el 31/12 (no acumulables)"}
                    </p>
                    {!naitusUnlocked && (
                      <Badge variant="outline" className="absolute top-2 right-2 text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                        <Lock className="h-2.5 w-2.5 mr-0.5" />
                        {isContractor && !contractorActivated ? "1 ano" : "Usar 15 dias"}
                      </Badge>
                    )}
                    {naitusUnlocked && monthsUntilExpiry > 0 && (
                      <Badge variant="outline" className="absolute top-2 right-2 text-[10px] bg-purple-100 text-purple-700 border-purple-300">
                        <Clock className="h-2.5 w-2.5 mr-0.5" />
                        {monthsUntilExpiry} meses
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                {/* Card En Deuda */}
                <Card className={`${(balance?.debtDays || 0) < 0 ? "bg-red-50 border-red-200" : "bg-background border-secondary"}`}>
                  <CardContent className="p-4 text-left">
                    <p className={`font-medium mb-1 text-sm ${(balance?.debtDays || 0) < 0 ? "text-red-700" : "text-slate-600"}`}>
                      Días en Deuda
                    </p>
                    <p className={`text-3xl font-bold ${(balance?.debtDays || 0) < 0 ? "text-red-700" : "text-slate-400"}`}>
                      {Math.abs(balance?.debtDays || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(balance?.debtDays || 0) < 0 ? "Pendiente de compensar" : "Sin deudas"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Saldo Total */}
              <Card className="mt-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300">Saldo Total Disponible</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Legales + Naitus - Deuda
                      </p>
                    </div>
                    <p className="text-4xl font-bold">{totalAvailable.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Registrar Vacaciones - Botón que abre modal */}
            <div className="bg-card px-5 border rounded-lg py-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Registrar Vacaciones</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registra un nuevo período de vacaciones aprobadas
                  </p>
                </div>
              </div>

              {isInactive ? (
                <Alert className="bg-red-50 border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 text-sm">
                    No se pueden registrar vacaciones para un colaborador inactivo.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button 
                  onClick={() => setRegisterDialogOpen(true)} 
                  className="w-full" 
                  size="lg"
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Registrar Vacaciones
                </Button>
              )}
            </div>

            {/* Modal de Registro de Vacaciones */}
            <RegisterVacationDialog
              preselectedEmployeeId={employee.id}
              open={registerDialogOpen}
              onOpenChange={setRegisterDialogOpen}
              triggerButton={false}
              onVacationRegistered={onVacationRegistered}
            />

            {/* Registrar Permiso sin Goce */}
            <div className="bg-card px-5 border border-orange-200 rounded-lg py-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Registrar Permiso sin Goce</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registra un permiso sin goce de sueldo (no afecta el saldo)
                  </p>
                </div>
              </div>

              {isInactive ? (
                <Alert className="bg-red-50 border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 text-sm">
                    No se pueden registrar permisos para un colaborador inactivo.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button 
                  onClick={() => setUnpaidLeaveDialogOpen(true)} 
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
                  size="lg"
                >
                  <CalendarOff className="h-4 w-4 mr-2" />
                  Registrar Permiso sin Goce
                </Button>
              )}
            </div>

            {/* Modal de Registro de Permiso sin Goce */}
            <AdminRegisterUnpaidLeaveDialog
              preselectedEmployeeId={employee.id}
              open={unpaidLeaveDialogOpen}
              onOpenChange={setUnpaidLeaveDialogOpen}
              triggerButton={false}
            />
          </TabsContent>

          {/* Tab 2: Ficha (Información Personal) */}
          <TabsContent value="personal" className="space-y-6 mt-6">
            {/* Success Message */}
            {saveSuccess && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 text-sm">
                  Los datos personales se han actualizado correctamente.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {saveError && (
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700 text-sm">
                  {saveError}
                </AlertDescription>
              </Alert>
            )}

            {/* Datos Personales */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  Datos Personales
                </h3>
                {!isEditingPersonal && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEditingPersonal(true)}
                    className="text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
              
              <Card>
                <CardContent className="p-4">
                  {isEditingPersonal ? (
                    // Edit Mode
                    <div className="space-y-4">
                      {/* Nombre completo */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-fullName" className="text-sm font-medium text-slate-700">
                          Nombre completo *
                        </Label>
                        <Input
                          id="edit-fullName"
                          value={editFormData.fullName}
                          onChange={(e) => {
                            setEditFormData({ ...editFormData, fullName: e.target.value })
                            if (validationErrors.fullName) {
                              setValidationErrors({ ...validationErrors, fullName: "" })
                            }
                          }}
                          placeholder="Ingresa el nombre completo"
                          className={validationErrors.fullName ? "border-red-300 focus-visible:ring-red-300" : ""}
                        />
                        {validationErrors.fullName && (
                          <p className="text-xs text-red-600">{validationErrors.fullName}</p>
                        )}
                      </div>

                      {/* Correo electrónico */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-email" className="text-sm font-medium text-slate-700">
                          Correo electrónico *
                        </Label>
                        <Input
                          id="edit-email"
                          type="email"
                          value={editFormData.email}
                          onChange={(e) => {
                            setEditFormData({ ...editFormData, email: e.target.value })
                            if (validationErrors.email) {
                              setValidationErrors({ ...validationErrors, email: "" })
                            }
                          }}
                          placeholder="correo@ejemplo.com"
                          className={validationErrors.email ? "border-red-300 focus-visible:ring-red-300" : ""}
                        />
                        {validationErrors.email && (
                          <p className="text-xs text-red-600">{validationErrors.email}</p>
                        )}
                      </div>

                      {/* RUT / Identificación */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-rut" className="text-sm font-medium text-slate-700">
                          RUT / Identificación *
                        </Label>
                        <Input
                          id="edit-rut"
                          value={editFormData.rut}
                          onChange={(e) => {
                            setEditFormData({ ...editFormData, rut: e.target.value })
                            if (validationErrors.rut) {
                              setValidationErrors({ ...validationErrors, rut: "" })
                            }
                          }}
                          placeholder="12.345.678-9"
                          className={validationErrors.rut ? "border-red-300 focus-visible:ring-red-300" : ""}
                        />
                        {validationErrors.rut && (
                          <p className="text-xs text-red-600">{validationErrors.rut}</p>
                        )}
                      </div>

                      {/* Fecha de nacimiento */}
                      <div className="space-y-2">
                        <Label htmlFor="edit-birthDate" className="text-sm font-medium text-slate-700">
                          Fecha de nacimiento
                        </Label>
                        <Input
                          id="edit-birthDate"
                          type="date"
                          value={editFormData.birthDate}
                          onChange={(e) => {
                            setEditFormData({ ...editFormData, birthDate: e.target.value })
                            if (validationErrors.birthDate) {
                              setValidationErrors({ ...validationErrors, birthDate: "" })
                            }
                          }}
                          max={new Date().toISOString().split("T")[0]}
                          className={validationErrors.birthDate ? "border-red-300 focus-visible:ring-red-300" : ""}
                        />
                        {validationErrors.birthDate && (
                          <p className="text-xs text-red-600">{validationErrors.birthDate}</p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="flex-1 bg-transparent"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSavePersonalInfo}
                          disabled={isSaving}
                          className="flex-1"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Guardar cambios
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-600">Nombre completo</span>
                        <span className="text-sm font-semibold text-slate-900">{employee.fullName}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-600">Correo electrónico</span>
                        <span className="text-sm font-semibold text-slate-900">{employee.email}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-600">RUT / Identificación</span>
                        <span className="text-sm font-semibold text-slate-900">{employee.rut}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <div className="flex items-center gap-2">
                          <Cake className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-600">Fecha de nacimiento</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {employee.birthDate 
                            ? parseLocalDate(employee.birthDate).toLocaleDateString("es-CL", { 
                                day: "2-digit", 
                                month: "long", 
                                year: "numeric" 
                              })
                            : <span className="text-slate-400 italic">No registrada</span>
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 4: Contrato */}
          <TabsContent value="contract" className="space-y-6 mt-6">
            {/* Estado del Contrato - Principal */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Power className="h-4 w-4" />
                Estado del Contrato
              </h3>
              <Card className={employeeStatus === "activo" ? "border-green-200" : "border-red-200"}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${employeeStatus === "activo" ? "bg-green-500" : "bg-red-500"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${employeeStatus === "activo" ? "text-green-700" : "text-red-700"}`}>
                          Contrato {employeeStatus === "activo" ? "Activo" : "Inactivo"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {employeeStatus === "activo" 
                            ? "El colaborador puede solicitar vacaciones" 
                            : "El colaborador no puede solicitar vacaciones"}
                        </p>
                      </div>
                    </div>
                    <Select
                      value={employeeStatus}
                      onValueChange={async (value: "activo" | "inactivo") => {
                        if (value === "activo" && employee) {
                          const otherActive = employees.find(
                            (e) => e.email === employee.email && e.id !== employee.id && e.status === "activo"
                          )
                          if (otherActive) {
                            alert(`No se puede reactivar: ya existe otro colaborador activo con el correo ${employee.email} (${otherActive.fullName}).`)
                            return
                          }
                        }
                        setEmployeeStatus(value)
                        if (employee) {
                          await updateEmployee(employee.id, {
                            status: value,
                            statusReason: value === "inactivo" ? "Desactivado por administrador" : "",
                            statusEndDate: value === "inactivo" ? new Date().toISOString().split("T")[0] : "",
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activo">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Activo
                          </div>
                        </SelectItem>
                        <SelectItem value="inactivo">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            Inactivo
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {employeeStatus === "inactivo" && (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700 text-xs">
                        Al desactivar el contrato, el colaborador no podrá solicitar nuevas vacaciones ni acceder al sistema.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cargo Actual - Editable */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-600" />
                  Cargo Actual
                </h3>
                {!isEditingPosition && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEditingPosition(true)}
                    className="text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                )}
              </div>

              {/* Success/Error Messages */}
              {positionSaveSuccess && (
                <Alert className="bg-green-50 border-green-200 mb-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 text-sm">
                    El cargo se ha actualizado correctamente.
                  </AlertDescription>
                </Alert>
              )}
              {positionSaveError && (
                <Alert className="bg-red-50 border-red-200 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 text-sm">
                    {positionSaveError}
                  </AlertDescription>
                </Alert>
              )}

              <Card className="border-blue-100">
                <CardContent className="p-4">
                  {isEditingPosition ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="edit-position" className="text-sm font-medium text-slate-700">
                          Cargo del colaborador *
                        </Label>
                        <Input
                          id="edit-position"
                          value={editPosition}
                          onChange={(e) => {
                            setEditPosition(e.target.value)
                            if (positionValidationError) {
                              setPositionValidationError("")
                            }
                          }}
                          placeholder="Ej: Desarrollador Senior"
                          className={positionValidationError ? "border-red-300 focus-visible:ring-red-300" : ""}
                        />
                        {positionValidationError && (
                          <p className="text-xs text-red-600">{positionValidationError}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelPositionEdit}
                          disabled={isSavingPosition}
                          className="flex-1 bg-transparent"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSavePosition}
                          disabled={isSavingPosition}
                          className="flex-1"
                        >
                          {isSavingPosition ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Guardar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-slate-800">
                        {employee.position || <span className="text-slate-400 italic text-base">Sin cargo asignado</span>}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Datos del Contrato Actual */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-600" />
                Datos del Contrato Actual
              </h3>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Tipo de contrato</span>
                    <Badge variant={contractType === "contractor_extranjero" ? "secondary" : "outline"} className="text-sm">
                      {contractType === "contractor_extranjero" ? "Contractor en el extranjero" : "Contrato en Chile"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Fecha de inicio</span>
                    <span className="text-sm font-semibold">{parseLocalDate(employee.hireDate).toLocaleDateString("es-CL")}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600">Antigüedad</span>
                    <span className="text-sm font-semibold text-blue-700">{calculateSeniority(employee.hireDate)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Documentos Adjuntos - Contrato y Anexos */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-600" />
                Contrato y Anexos
              </h3>
              {collaboratorContracts.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-slate-500">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No hay contrato registrado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {collaboratorContracts.filter(c => c.status === "activo").map((contract) => (
                    <Card key={contract.id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-medium text-slate-600 flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            Documentos del contrato
                          </p>
                          <div className="relative">
                            <input
                              type="file"
                              ref={(el) => { fileInputRefs.current[contract.id] = el }}
                              className="hidden"
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileUpload(contract.id, file)
                                e.target.value = ""
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              disabled={uploadingContractId === contract.id}
                              onClick={() => fileInputRefs.current[contract.id]?.click()}
                            >
                              {uploadingContractId === contract.id ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Subiendo...</>
                              ) : (
                                <><Upload className="h-3 w-3" /> Adjuntar PDF</>
                              )}
                            </Button>
                          </div>
                        </div>
                        {(contract.files && contract.files.length > 0) ? (
                          <ul className="space-y-1.5">
                            {contract.files.map((f) => (
                              <li key={f.path} className="flex items-center justify-between bg-white rounded border border-slate-200 px-2.5 py-1.5">
                                <a
                                  href={f.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[200px]"
                                  title={f.name}
                                >
                                  <Download className="h-3 w-3 flex-shrink-0" />
                                  {f.name}
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-400 hover:text-red-600"
                                  disabled={deletingFile === f.path}
                                  onClick={() => handleFileDelete(contract.id, f.path)}
                                >
                                  {deletingFile === f.path ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Sin documentos adjuntos. Adjunte el contrato o anexos en formato PDF.</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Reglas de Días Naitus */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-green-600" />
                Información sobre Días Naitus
              </h3>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-green-700">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-900">No son acumulables</p>
                      <p className="text-xs text-green-700 mt-1">
                        Los 5 Días Naitus son un regalo de la empresa que NO se acumulan de un año a otro.
                        Si no se utilizan antes del 31 de diciembre, se pierden.
                      </p>
                    </div>
                  </div>

                  <Separator className="bg-green-200" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-green-700">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-900">Renovación Anual</p>
                      <p className="text-xs text-green-700 mt-1">
                        Al iniciar cada año calendario, los Días Naitus se renuevan automáticamente a 5 días.
                      </p>
                    </div>
                  </div>

                  <Separator className="bg-green-200" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-green-700">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-900">Requisito de Desbloqueo</p>
                      <p className="text-xs text-green-700 mt-1">
                        Los Días Naitus solo se desbloquean después de usar al menos 15 días legales.
                      </p>
                    </div>
                  </div>

                  {monthsUntilExpiry > 0 && naitusUnlocked && (
                    <>
                      <Separator className="bg-green-200" />
                      <div className="flex items-center gap-2 bg-green-100 p-3 rounded-md">
                        <Clock className="h-4 w-4 text-green-700" />
                        <p className="text-xs text-green-800">
                          <span className="font-bold">{monthsUntilExpiry} {monthsUntilExpiry === 1 ? "mes" : "meses"}</span> restantes
                          para utilizar los Días Naitus antes de fin de año.
                        </p>
                      </div>
                    </>
                  )}

                  {naitusExpired && (
                    <>
                      <Separator className="bg-green-200" />
                      <div className="flex items-center gap-2 bg-red-100 p-3 rounded-md">
                        <AlertTriangle className="h-4 w-4 text-red-700" />
                        <p className="text-xs text-red-800 font-medium">
                          Los Días Naitus del período anterior han expirado por no haber sido utilizados.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info adicional según tipo de contrato */}
            {contractType === "contractor_extranjero" && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Nota para Contractors en el Extranjero
                </h3>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-amber-700">
                      Como contractor en el extranjero, tus días legales también se reinician cada año calendario.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
