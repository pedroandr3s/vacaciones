"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { UserPlus, AlertTriangle, RefreshCw, Loader2 } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { generateId } from "@/lib/firebase-services"
import { saveCredentialsToSheet, generateProvisionalPassword } from "@/lib/google-sheets"
import type { Employee, VacationBalance, Contract } from "@/lib/types"
import { calculateAccruedLegalDays, calculateContractorCycle } from "@/lib/utils"

type FormData = {
  fullName: string
  rut: string
  email: string
  birthDate: string
  hireDate: string
  position: string
  contractType: "chile" | "contractor_extranjero"
  initialBalance: string
}

const initialFormData: FormData = {
  fullName: "",
  rut: "",
  email: "",
  birthDate: "",
  hireDate: "",
  position: "",
  contractType: "chile",
  initialBalance: "",
}

interface AddCollaboratorDialogProps {
  onCollaboratorAdded?: () => void
}

export function AddCollaboratorDialog({ onCollaboratorAdded }: AddCollaboratorDialogProps) {
  const { employees, balances, contracts, addEmployee, updateEmployee, addBalance, updateBalance: updateBalanceFn, addContract } = useData()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [existingCollaborator, setExistingCollaborator] = useState<Employee | null>(null)
  const [showRehirePrompt, setShowRehirePrompt] = useState(false)
  const [isCreatingRehire, setIsCreatingRehire] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [sheetWarning, setSheetWarning] = useState("")

  const isContractor = formData.contractType === "contractor_extranjero"
  const idLabel = isContractor ? "DNI" : "RUT"
  const idPlaceholder = isContractor ? "Ej: 12345678" : "Ej: 12.345.678-9"
  const idMinLength = isContractor ? 6 : 9

  // Verificar si el RUT/DNI ya existe
  useEffect(() => {
    if (formData.rut.length >= idMinLength) {
      const normalizedInput = formData.rut.replace(/\./g, "").replace("-", "").toUpperCase()
      const existing = employees.find(
        (e) => e.rut.replace(/\./g, "").replace("-", "").toUpperCase() === normalizedInput
      )
      if (existing) {
        setExistingCollaborator(existing)
        if (existing.status === "inactivo") {
          setShowRehirePrompt(true)
        }
      } else {
        setExistingCollaborator(null)
        setShowRehirePrompt(false)
      }
    } else {
      setExistingCollaborator(null)
      setShowRehirePrompt(false)
    }
  }, [formData.rut, idMinLength])

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const formatRut = (value: string) => {
    // Remove all non-alphanumeric characters
    let rut = value.replace(/[^0-9kK]/g, "")
    if (rut.length > 1) {
      const dv = rut.slice(-1)
      const body = rut.slice(0, -1)
      // Add dots every 3 digits from right to left
      const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
      rut = `${formattedBody}-${dv}`
    }
    return rut.toUpperCase()
  }

  const handleIdChange = (value: string) => {
    if (isContractor) {
      // DNI: solo numeros, sin formato especial
      const cleaned = value.replace(/[^0-9a-zA-Z]/g, "")
      handleInputChange("rut", cleaned)
    } else {
      const formatted = formatRut(value)
      handleInputChange("rut", formatted)
    }
  }

  const handleCreateRehire = () => {
    setIsCreatingRehire(true)
    setShowRehirePrompt(false)
    // Pre-fill with existing data
    if (existingCollaborator) {
      setFormData((prev) => ({
        ...prev,
        fullName: existingCollaborator.fullName,
        email: existingCollaborator.email,
      }))
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError("")
    setSheetWarning("")
    const now = new Date().toISOString()

    try {
      // Generate provisional password for the new user
      const provisionalPassword = generateProvisionalPassword()

      if (isCreatingRehire && existingCollaborator) {
        // Rehire: reactivate existing employee with new contract data
        await updateEmployee(existingCollaborator.id, {
          hireDate: formData.hireDate,
          position: formData.position || existingCollaborator.position,
          contractType: formData.contractType,
          status: "activo",
          mustChangePassword: true,
          statusReason: undefined,
          statusEndDate: undefined,
          updatedAt: now,
        })

        // Create new contract
        const newContract: Contract = {
          id: generateId("contracts"),
          collaboratorId: existingCollaborator.id,
          startDate: formData.hireDate,
          status: "activo",
          position: formData.position,
          initialBalance: formData.initialBalance.trim() !== "" ? parseFloat(formData.initialBalance) : undefined,
          createdAt: now,
          updatedAt: now,
        }
        await addContract(newContract)

        // Create or update balance
        const isContractor = formData.contractType === "contractor_extranjero"
        const parsedBalance = formData.initialBalance.trim() !== "" ? parseFloat(formData.initialBalance) : null
        const hasManualBalance = parsedBalance !== null && !isNaN(parsedBalance)
        const legalDays = hasManualBalance
          ? parsedBalance
          : isContractor
            ? 15
            : calculateAccruedLegalDays(formData.hireDate, "chile")

        const existingBal = balances.find((b) => b.employeeId === existingCollaborator.id)
        const newBalance: VacationBalance = {
          id: existingBal?.id || generateId("vacationBalances"),
          employeeId: existingCollaborator.id,
          year: new Date().getFullYear(),
          legalDays,
          naitusDays: 5,
          debtDays: 0,
          usedDays: 0,
          createdAt: now,
          updatedAt: now,
        }
        if (existingBal) {
          await updateBalanceFn(existingBal.id, newBalance)
        } else {
          await addBalance(newBalance)
        }

        // Save credentials to Google Sheet
        const sheetResult = await saveCredentialsToSheet({
          usuario: existingCollaborator.fullName,
          correo: existingCollaborator.email,
          contrasena: provisionalPassword,
        })
        if (!sheetResult.success) {
          setSheetWarning(sheetResult.message)
        }

        // Send to n8n webhook
        const rehireNameParts = existingCollaborator.fullName.trim().split(" ")
        try {
          await fetch("/api/webhook/naitus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              usuarios: [{
                nombre: rehireNameParts[0] || "",
                apellido: rehireNameParts.slice(1).join(" ") || "",
                correo: existingCollaborator.email,
                contrasena: provisionalPassword,
              }],
            }),
          })
        } catch (e) {
          console.warn("No se pudo enviar a n8n:", e)
        }
      } else {
        // 1. Create Firebase Auth user via server-side API
        const authResponse = await fetch("/api/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, password: provisionalPassword }),
        })
        const authResult = await authResponse.json()

        if (!authResult.success) {
          setSubmitError(authResult.error || "Error al crear la cuenta de acceso.")
          setIsSubmitting(false)
          return
        }

        // 2. Create employee in Firestore
        const newId = generateId("employees")
        const newEmployee: Employee = {
          id: newId,
          email: formData.email,
          fullName: formData.fullName,
          rut: formData.rut,
          birthDate: formData.birthDate || undefined,
          hireDate: formData.hireDate,
          position: formData.position,
          role: "employee",
          contractType: formData.contractType,
          status: "activo",
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
        }
        await addEmployee(newEmployee)

        // 3. Create contract
        const newContract: Contract = {
          id: generateId("contracts"),
          collaboratorId: newId,
          startDate: formData.hireDate,
          status: "activo",
          position: formData.position,
          initialBalance: formData.initialBalance.trim() !== "" ? parseFloat(formData.initialBalance) : undefined,
          createdAt: now,
          updatedAt: now,
        }
        await addContract(newContract)

        // 4. Create balance
        const isContractor = formData.contractType === "contractor_extranjero"
        const parsedBalance = formData.initialBalance.trim() !== "" ? parseFloat(formData.initialBalance) : null
        const hasManualBalance = parsedBalance !== null && !isNaN(parsedBalance)
        const legalDays = hasManualBalance
          ? parsedBalance
          : isContractor
            ? 15
            : calculateAccruedLegalDays(formData.hireDate, "chile")

        const newBalance: VacationBalance = {
          id: generateId("vacationBalances"),
          employeeId: newId,
          year: new Date().getFullYear(),
          legalDays,
          naitusDays: 5,
          debtDays: 0,
          usedDays: 0,
          createdAt: now,
          updatedAt: now,
        }
        await addBalance(newBalance)

        // 5. Save credentials to Google Sheet
        const sheetResult = await saveCredentialsToSheet({
          usuario: formData.fullName,
          correo: formData.email,
          contrasena: provisionalPassword,
        })
        if (!sheetResult.success) {
          setSheetWarning(sheetResult.message)
        }

        // 6. Send to n8n webhook
        const nameParts = formData.fullName.trim().split(" ")
        const nombre = nameParts[0] || ""
        const apellido = nameParts.slice(1).join(" ") || ""
        try {
          await fetch("/api/webhook/naitus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              usuarios: [{ nombre, apellido, correo: formData.email, contrasena: provisionalPassword }],
            }),
          })
        } catch (e) {
          console.warn("No se pudo enviar a n8n:", e)
        }
      }

      // Reset form, close dialog, and notify parent
      setFormData(initialFormData)
      setExistingCollaborator(null)
      setShowRehirePrompt(false)
      setIsCreatingRehire(false)
      setSubmitError("")
      setOpen(false)
      onCollaboratorAdded?.()
    } catch (err) {
      console.error("Error creating collaborator:", err)
      setSubmitError("Error inesperado al crear el colaborador. Intente nuevamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData(initialFormData)
    setExistingCollaborator(null)
    setShowRehirePrompt(false)
    setIsCreatingRehire(false)
    setSubmitError("")
    setSheetWarning("")
    setOpen(false)
  }

  const isFormValid =
    formData.fullName.trim() !== "" &&
    formData.rut.length >= idMinLength &&
    formData.email.trim() !== "" &&
    formData.hireDate !== "" &&
    formData.position.trim() !== "" &&
    (!existingCollaborator || existingCollaborator.status === "inactivo")

  const handleRutChange = (value: string) => {
    handleIdChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (isOpen) {
          setSubmitError("")
          setSheetWarning("")
          setOpen(true)
        } else {
          handleClose()
        }
      }}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Añadir Colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreatingRehire ? "Crear Nuevo Contrato (Reingreso)" : "Añadir Nuevo Colaborador"}
          </DialogTitle>
          <DialogDescription>
            {isCreatingRehire
              ? `Creando nuevo periodo de contrato para ${existingCollaborator?.fullName}`
              : "Complete los datos del nuevo colaborador para registrarlo en el sistema."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alert for existing active collaborator */}
          {existingCollaborator && existingCollaborator.status === "activo" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{idLabel} ya registrado</AlertTitle>
              <AlertDescription>
                Este {idLabel} pertenece a <strong>{existingCollaborator.fullName}</strong> quien tiene un contrato activo.
                No es posible crear un nuevo registro.
              </AlertDescription>
            </Alert>
          )}

          {/* Rehire prompt */}
          {showRehirePrompt && existingCollaborator && (
            <Alert className="bg-amber-50 border-amber-200">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Colaborador con historial</AlertTitle>
              <AlertDescription className="text-amber-700">
                <p className="mb-2">
                  <strong>{existingCollaborator.fullName}</strong> ya tiene un historial en el sistema pero su contrato
                  está <strong>Inactivo</strong>.
                </p>
                <p className="mb-3 text-sm">
                  Motivo: {existingCollaborator.statusReason || "No especificado"} 
                  {existingCollaborator.statusEndDate && ` (${new Date(existingCollaborator.statusEndDate).toLocaleDateString("es-CL")})`}
                </p>
                <Button size="sm" variant="outline" className="bg-white" onClick={handleCreateRehire}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Crear nuevo periodo de contrato
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Form fields */}
          {/* Row 1: Nombre completo + Tipo de contrato */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre Completo *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
                placeholder="Ej: Juan Perez Gonzalez"
                disabled={isCreatingRehire}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractType">Tipo de Contrato *</Label>
              <Select
                value={formData.contractType}
                onValueChange={(value: "chile" | "contractor_extranjero") => {
                  handleInputChange("contractType", value)
                  handleInputChange("rut", "")
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chile">Contrato en Chile</SelectItem>
                  <SelectItem value="contractor_extranjero">Contractor en el extranjero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: RUT/DNI + Fecha de nacimiento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rut">{idLabel} *</Label>
              <Input
                id="rut"
                value={formData.rut}
                onChange={(e) => handleIdChange(e.target.value)}
                placeholder={idPlaceholder}
                maxLength={isContractor ? 20 : 12}
                disabled={isCreatingRehire}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => handleInputChange("birthDate", e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                disabled={isCreatingRehire}
              />
            </div>
          </div>

          {/* Row 3: Correo electronico + Cargo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electronico *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Ej: jperez@empresa.cl"
                disabled={isCreatingRehire}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Cargo *</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => handleInputChange("position", e.target.value)}
                placeholder="Ej: Desarrollador"
              />
            </div>
          </div>

          {/* Row 4: Fecha de inicio de contrato + Saldo inicial */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hireDate">Fecha de Inicio de Contrato *</Label>
              <Input
                id="hireDate"
                type="date"
                value={formData.hireDate}
                onChange={(e) => handleInputChange("hireDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialBalance">Saldo Inicial de Vacaciones</Label>
              <Input
                id="initialBalance"
                type="number"
                step="0.5"
                value={formData.initialBalance}
                onChange={(e) => handleInputChange("initialBalance", e.target.value)}
                placeholder="Auto-calcular"
              />
            </div>
          </div>

          {formData.contractType === "contractor_extranjero" && (
            <Alert className="bg-purple-50 border-purple-200">
              <AlertDescription className="text-purple-700 text-sm">
                <strong>Beneficio inmediato:</strong> Los contractors en el extranjero reciben 15 dias legales y 5 dias Naitus 
                desde el primer dia de su contrato. Los dias se renuevan en cada aniversario.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {submitError && (
          <Alert variant="destructive" className="mx-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {sheetWarning && (
          <Alert className="mx-6 bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 text-sm">
              El colaborador fue creado correctamente, pero: {sheetWarning}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : isCreatingRehire ? (
              "Crear Nuevo Contrato"
            ) : (
              "Registrar Colaborador"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
