"use client"

import React from "react"

import { useState, useMemo } from "react"
import type { EmployeeWithBalance } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { generateId } from "@/lib/firebase-services"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarPlus, AlertTriangle, ArrowRight, Lock, Check, CalendarOff, Send, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { sendVacationToN8n, type N8nVacationPayload } from "@/lib/n8n-webhook"
import {
  calculateVacationDaysWithHolidays,
  simulateVacationApproval,
  getTotalAvailable,
  isNaitusUnlocked,
  getEffectiveNaitusDays,
  getHolidayName,
  calculateBusinessDays,
  isBenefitUnlocked, // Declare the variable here
  getEffectiveBenefitDays, // Declare the variable here
  hasOverlappingRequests, // Declare the variable here
  getAbsenceTypeLabel, // Declare the variable here
  parseLocalDate,
} from "@/lib/utils"

type Props = {
  onVacationRegistered?: () => void
  preselectedEmployeeId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  triggerButton?: boolean // If false, don't render the trigger button (controlled externally)
}

export function RegisterVacationDialog({ 
  onVacationRegistered, 
  preselectedEmployeeId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerButton = true
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const { employees, balances, requests: allRequests, holidays, addRequest, updateBalance, updateRequest } = useData()
  
  // Use controlled or uncontrolled state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(preselectedEmployeeId || "")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [webhookMessage, setWebhookMessage] = useState("")

  // Get employees with their balances - ONLY ACTIVE collaborators
  const employeesWithBalances: EmployeeWithBalance[] = useMemo(() => {
    return employees
      .filter((e) => e.role !== "admin" && e.status === "activo") // Filter only active collaborators
      .map((employee) => ({
        ...employee,
        balance: balances.find((b) => b.employeeId === employee.id),
      }))
  }, [employees, balances])

  // Selected employee data
  const selectedEmployee = useMemo(() => {
    return employeesWithBalances.find((e) => e.id === selectedEmployeeId)
  }, [employeesWithBalances, selectedEmployeeId])

  // Security check: verify employee is active (in case ID is forced)
  const isSelectedEmployeeActive = useMemo(() => {
    if (!selectedEmployeeId) return true
    const employee = employees.find((e) => e.id === selectedEmployeeId)
    return employee?.status === "activo"
  }, [selectedEmployeeId, employees])

  const [securityError, setSecurityError] = useState<string | null>(null)

  // Calculate vacation days with holiday breakdown
  const daysCalculation = useMemo(() => {
    if (!startDate || !endDate) return null
    const start = parseLocalDate(startDate)
    const end = parseLocalDate(endDate)
    if (end < start) return null
    return calculateVacationDaysWithHolidays(start, end, holidays)
  }, [startDate, endDate, holidays])

  const businessDays = daysCalculation?.businessDaysToDeduct || 0

  // Balance simulation
  const simulation = useMemo(() => {
    if (!selectedEmployee?.balance || businessDays === 0) return null

    const balance = selectedEmployee.balance
    const empContractType = (selectedEmployee.contractType || "chile") as "chile" | "contractor_extranjero"
    const naitusUnlocked = isNaitusUnlocked(balance, empContractType)
    const effectiveNaitus = getEffectiveNaitusDays(balance, empContractType)

    return simulateVacationApproval(
      balance.legalDays,
      naitusUnlocked ? effectiveNaitus : 0,
      balance.debtDays,
      balance.usedDays,
      businessDays,
    )
  }, [selectedEmployee, businessDays])

  // Current balance info
  const currentBalance = useMemo(() => {
    if (!selectedEmployee?.balance) return null

    const balance = selectedEmployee.balance
    const contractType = (selectedEmployee.contractType || "chile") as "chile" | "contractor_extranjero"
    const naitusUnlocked = isNaitusUnlocked(balance, contractType)
    const effectiveNaitus = getEffectiveNaitusDays(balance, contractType)
    const availableLegal = balance.legalDays - balance.usedDays
    const totalAvailable = getTotalAvailable(
      balance.legalDays,
      balance.naitusDays,
      balance.usedDays,
      balance.debtDays,
      contractType,
    )

    return {
      legalDays: balance.legalDays,
      usedDays: balance.usedDays,
      availableLegal,
      naitusDays: balance.naitusDays,
      effectiveNaitus,
      naitusUnlocked,
      debtDays: balance.debtDays,
      totalAvailable,
      contractType,
    }
  }, [selectedEmployee])

  const handleSubmit = async () => {
    if (!selectedEmployee || !startDate || !endDate || businessDays === 0 || !currentBalance || !simulation) return

    // Security check: verify collaborator has an active contract
    const employeeFromDB = employees.find((e) => e.id === selectedEmployeeId)
    if (!employeeFromDB || employeeFromDB.status !== "activo") {
      setSecurityError("Accion denegada: El colaborador seleccionado no posee un contrato vigente.")
      return
    }

    // Check for overlapping vacations (approved or pending)
    const employeeRequests = allRequests.filter((r) => r.employeeId === selectedEmployee.id)
    const overlapCheck = hasOverlappingRequests(
      parseLocalDate(startDate),
      parseLocalDate(endDate),
      employeeRequests,
      undefined,
      true
    )
    if (overlapCheck.overlaps && overlapCheck.conflictingRequest) {
      const conflict = overlapCheck.conflictingRequest
      const conflictType = getAbsenceTypeLabel(conflict.absenceType)
      const conflictStatus = conflict.status === "pending" ? "pendiente" : "aprobada"
      setSecurityError(
        `El colaborador ya tiene una ausencia ${conflictStatus} (${conflictType}) del ${conflict.startDate} al ${conflict.endDate} que se solapa con el periodo seleccionado. No se pueden programar ausencias simultaneas.`
      )
      return
    }

    setSecurityError(null)
    setIsSubmitting(true)
    setWebhookStatus("sending")
    setWebhookMessage("")

    // --- Update the balance in Firestore ---
    const bal = balances.find((b) => b.employeeId === selectedEmployee.id)
    if (bal) {
      const balanceUpdates: Record<string, unknown> = {
        usedDays: bal.usedDays + simulation.legalConsumed,
        updatedAt: new Date().toISOString(),
      }
      if (simulation.naitusConsumed > 0) {
        balanceUpdates.naitusDays = Math.max(0, bal.naitusDays - simulation.naitusConsumed)
      }
      if (simulation.debtConsumed > 0) {
        balanceUpdates.debtDays = (bal.debtDays || 0) - simulation.debtConsumed
      }
      try {
        await updateBalance(bal.id, balanceUpdates)
      } catch (err) {
        console.error("[RegisterVacation] Error al actualizar saldo:", err)
        const msg = err instanceof Error ? err.message : String(err)
        setSecurityError(`Error al actualizar el saldo: ${msg}`)
        setIsSubmitting(false)
        setWebhookStatus("idle")
        return
      }
    }

    // Create a vacation request record
    const newRequest = {
      id: generateId("vacationRequests"),
      employeeId: selectedEmployee.id,
      absenceType: "vacacion_remunerada" as const,
      startDate,
      endDate,
      totalDays: businessDays,
      legalDaysUsed: simulation.legalConsumed,
      naitusDaysUsed: simulation.naitusConsumed,
      debtDaysUsed: simulation.debtConsumed,
      status: "approved" as const,
      notes: notes || "",
      reviewedBy: "1",
      reviewedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    try {
      await addRequest(newRequest)
    } catch (err) {
      console.error("[RegisterVacation] Error al guardar solicitud:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setSecurityError(`Error al guardar la solicitud: ${msg}`)
      setIsSubmitting(false)
      setWebhookStatus("idle")
      return
    }

    // Build the n8n payload with all relevant vacation data
    const payload: N8nVacationPayload = {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.fullName,
      employeeEmail: selectedEmployee.email,
      employeePosition: selectedEmployee.position || "Colaborador",
      contractType: (selectedEmployee.contractType || "chile") as "chile" | "contractor_extranjero",
      leaveType: "vacacion_remunerada",
      startDate,
      endDate,
      totalBusinessDays: businessDays,
      notes: notes || "",
      balanceBefore: {
        legalDays: currentBalance.legalDays,
        legalUsed: currentBalance.usedDays,
        legalAvailable: currentBalance.availableLegal,
        naitusDays: currentBalance.naitusDays,
        debtDays: currentBalance.debtDays,
        totalAvailable: currentBalance.totalAvailable,
      },
      balanceAfter: {
        legalConsumed: simulation.legalConsumed,
        naitusConsumed: simulation.naitusConsumed,
        debtGenerated: simulation.debtConsumed,
        projectedLegal: simulation.projectedLegal,
        projectedNaitus: simulation.projectedNaitus,
        projectedDebt: simulation.projectedDebt,
        totalAvailableAfter: simulation.totalAvailableAfter,
      },
      registeredBy: "admin",
      registeredAt: new Date().toISOString(),
    }

    // Show immediate feedback
    setWebhookStatus("sending")
    setWebhookMessage("Registrando evento en Google Calendar...")

    // Send to n8n webhook via server-side proxy (best-effort, vacation already registered)
    const result = await sendVacationToN8n(payload)

    // Si n8n devolvió el ID del evento de calendario, guardarlo en Firestore
    if (result.calendarEventId) {
      updateRequest(newRequest.id, { calendarEventId: result.calendarEventId }).catch((err) =>
        console.warn("[RegisterVacation] No se pudo guardar calendarEventId:", err)
      )
    }

    if (result.success) {
      setWebhookStatus("success")
      setWebhookMessage("✓ Vacaciones registradas correctamente. Evento agregado a Google Calendar y notificacion enviada al colaborador.")
    } else {
      // Webhook failed but vacation is already registered locally
      setWebhookStatus("error")
      setWebhookMessage(`✓ Vacaciones registradas correctamente. Nota: ${result.message}`)
    }

    // Always close and refresh after a delay, regardless of webhook result
    setTimeout(() => {
      setIsSubmitting(false)
      setWebhookStatus("idle")
      setWebhookMessage("")
      setOpen(false)
      resetForm()
      onVacationRegistered?.()
    }, 2500)
  }

  const resetForm = () => {
    setSelectedEmployeeId(preselectedEmployeeId || "")
    setStartDate("")
    setEndDate("")
    setNotes("")
    setSecurityError(null)
    setWebhookStatus("idle")
    setWebhookMessage("")
  }

  // Update selectedEmployeeId when preselectedEmployeeId changes
  React.useEffect(() => {
    if (preselectedEmployeeId) {
      setSelectedEmployeeId(preselectedEmployeeId)
    }
  }, [preselectedEmployeeId])

  const canSubmit =
    selectedEmployeeId && startDate && endDate && businessDays > 0 && !isSubmitting && isSelectedEmployeeActive

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton && (
        <DialogTrigger asChild>
          <Button>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Registrar Vacaciones
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Vacaciones Aprobadas</DialogTitle>
          <DialogDescription>
            Registre las vacaciones de un colaborador indicando el período aprobado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Security Error Alert */}
          {securityError && (
            <Alert className="bg-red-50 border-red-300">
              <AlertTriangle className="h-4 w-4 text-red-700" />
              <AlertDescription className="text-sm text-red-800 font-medium">
                {securityError}
              </AlertDescription>
            </Alert>
          )}

          {/* Employee Selection */}
          <div className="space-y-2">
            <Label htmlFor="employee">Seleccionar Colaborador</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Seleccione un colaborador" />
              </SelectTrigger>
              <SelectContent>
{employeesWithBalances.map((emp) => {
                                  const contractType = emp.contractType || "chile"
                                  const totalAvailable = emp.balance
                                    ? getTotalAvailable(
                                        emp.balance.legalDays,
                                        emp.balance.naitusDays,
                                        emp.balance.usedDays,
                                        emp.balance.debtDays,
                                      )
                                    : 0

                                  return (
                                    <SelectItem key={emp.id} value={emp.id}>
                                      <div className="flex items-center gap-2">
                                        <span>{emp.fullName}</span>
                                        <Badge
                                          variant="outline"
                                          className={
                                            totalAvailable > 0
                                              ? "bg-green-50 text-green-700"
                                              : "bg-red-50 text-red-700"
                                          }
                                        >
                                          {totalAvailable.toFixed(2)} días
                                        </Badge>
                                        {contractType === "contractor_extranjero" && (
                                          <Badge variant="secondary" className="text-xs">
                                            Contractor
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  )
                                })}
              </SelectContent>
            </Select>
          </div>

          {/* Colaborador Seleccionado - Badge compacto */}
          {selectedEmployee && currentBalance && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-slate-800">{selectedEmployee.fullName}</p>
                <p className="text-xs text-slate-500">{selectedEmployee.position || "Colaborador"}</p>
              </div>
              <Badge 
                variant="outline" 
                className={`text-sm px-3 py-1 ${currentBalance.totalAvailable > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}
              >
                {currentBalance.totalAvailable.toFixed(2)} días disponibles
              </Badge>
            </div>
          )}

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de Término</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          {/* Resumen de Días - Diseño limpio y jerárquico */}
          {daysCalculation && daysCalculation.totalCalendarDays > 0 && (
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                {/* Resultado destacado */}
                <div className="flex items-center justify-center mb-4 p-4 bg-slate-900 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Días a descontar del saldo</p>
                    <p className="text-4xl font-bold text-white">{daysCalculation.businessDaysToDeduct}</p>
                  </div>
                </div>

                {/* Desglose con lista jerárquica */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Desglose del período</p>
                  
                  <div className="space-y-1.5">
                    {/* Días solicitados */}
                    <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        <span className="text-sm text-slate-700">Días totales solicitados</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{daysCalculation.totalCalendarDays}</span>
                    </div>

                    {/* Fines de semana */}
                    {daysCalculation.weekendDays > 0 && (
                      <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-400" />
                          <span className="text-sm text-slate-600">Fines de semana (no se descuentan)</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-500">-{daysCalculation.weekendDays}</span>
                      </div>
                    )}

                    {/* Feriados detectados */}
                    {daysCalculation.holidayCount > 0 && (
                      <div className="py-2 px-3 bg-amber-50 rounded border border-amber-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CalendarOff className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">Feriados detectados (no se descuentan)</span>
                          </div>
                          <span className="text-sm font-semibold text-amber-700">-{daysCalculation.holidayCount}</span>
                        </div>
                        <ul className="ml-6 space-y-1">
                          {daysCalculation.holidaysInRange.map((date) => (
                            <li key={date} className="text-xs text-amber-700 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-amber-400" />
                              <span>{parseLocalDate(date).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</span>
                              <span className="text-amber-600">({getHolidayName(date, holidays)})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Impacto en tu Saldo - Unificado con visualización Antes/Después */}
          {simulation && currentBalance && (
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Impacto en tu Saldo
                </CardTitle>
                <p className="text-xs text-slate-500">Visualización del cambio en tus días disponibles</p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {/* Días Legales - Before/After */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-blue-900">Días Legales</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 line-through">{currentBalance.availableLegal.toFixed(2)}</span>
                      <ArrowRight className="h-4 w-4 text-blue-400" />
                      <span className={`text-lg font-bold ${simulation.projectedLegal >= 0 ? "text-blue-700" : "text-red-600"}`}>
                        {simulation.projectedLegal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {simulation.legalConsumed > 0 && (
                    <p className="text-xs text-blue-600 mt-1 ml-5">Se descontarán {simulation.legalConsumed} días de este tipo</p>
                  )}
                </div>

                {/* Días Naitus - Before/After */}
                <div className={`p-3 rounded-lg border ${currentBalance.naitusUnlocked ? "bg-green-50 border-green-100" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${currentBalance.naitusUnlocked ? "bg-green-500" : "bg-slate-300"}`} />
                      <span className={`text-sm font-medium ${currentBalance.naitusUnlocked ? "text-green-900" : "text-slate-500"}`}>
                        Días Naitus
                      </span>
                      {!currentBalance.naitusUnlocked && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">
                          <Lock className="h-2.5 w-2.5 mr-1" />
                          Bloqueado
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 line-through">{currentBalance.effectiveNaitus.toFixed(2)}</span>
                      <ArrowRight className={`h-4 w-4 ${currentBalance.naitusUnlocked ? "text-green-400" : "text-slate-300"}`} />
                      <span className={`text-lg font-bold ${currentBalance.naitusUnlocked ? (simulation.projectedNaitus >= 0 ? "text-green-700" : "text-red-600") : "text-slate-400"}`}>
                        {simulation.projectedNaitus.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {simulation.naitusConsumed > 0 && currentBalance.naitusUnlocked && (
                    <p className="text-xs text-green-600 mt-1 ml-5">Se descontarán {simulation.naitusConsumed} días de este tipo</p>
                  )}
                </div>

                {/* Deuda (si aplica) */}
                {(simulation.debtConsumed > 0 || currentBalance.debtDays < 0) && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-red-900">Días en Deuda</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400 line-through">{Math.abs(currentBalance.debtDays).toFixed(2)}</span>
                        <ArrowRight className="h-4 w-4 text-red-400" />
                        <span className="text-lg font-bold text-red-700">{Math.abs(simulation.projectedDebt).toFixed(2)}</span>
                      </div>
                    </div>
                    {simulation.debtConsumed > 0 && (
                      <p className="text-xs text-red-600 mt-1 ml-5">Se generarán {simulation.debtConsumed} días de deuda</p>
                    )}
                  </div>
                )}

                {/* Total Disponible - Destacado */}
                <Separator />
                <div className={`p-4 rounded-lg border-2 ${simulation.willGoIntoDebt ? "bg-red-50 border-red-300" : "bg-emerald-50 border-emerald-300"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${simulation.willGoIntoDebt ? "text-red-800" : "text-emerald-800"}`}>
                      Total Disponible
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-base text-slate-400 line-through">{currentBalance.totalAvailable.toFixed(2)}</span>
                      <ArrowRight className={`h-5 w-5 ${simulation.willGoIntoDebt ? "text-red-400" : "text-emerald-500"}`} />
                      <span className={`text-2xl font-bold ${simulation.willGoIntoDebt ? "text-red-700" : "text-emerald-700"}`}>
                        {simulation.totalAvailableAfter.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alerta de deuda */}
                {simulation.willGoIntoDebt && (
                  <Alert className="bg-red-100 border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-sm text-red-700">
                      Este registro generará <strong>{simulation.debtConsumed} días en deuda</strong> que se compensarán con futuros días acumulados.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Agregar notas o comentarios sobre estas vacaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Webhook status feedback */}
        {webhookStatus !== "idle" && (
          <div className={`mx-6 mb-2 flex items-center gap-2 rounded-lg border p-3 text-sm ${
            webhookStatus === "sending" ? "bg-blue-50 border-blue-200 text-blue-700" :
            webhookStatus === "success" ? "bg-green-50 border-green-200 text-green-700" :
            "bg-red-50 border-red-200 text-red-700"
          }`}>
            {webhookStatus === "sending" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                <span>Registrando vacaciones y enviando datos a n8n...</span>
              </>
            )}
            {webhookStatus === "success" && (
              <>
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{webhookMessage}</span>
              </>
            )}
            {webhookStatus === "error" && (
              <>
                <XCircle className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Error al enviar a n8n</p>
                  <p className="text-xs mt-0.5">{webhookMessage}</p>
                  <p className="text-xs mt-1 text-red-500">Las vacaciones fueron registradas localmente. Puede reintentar el envio.</p>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={webhookStatus === "sending"}>
            Cancelar
          </Button>
          {webhookStatus === "error" ? (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              <Send className="h-4 w-4 mr-2" />
              Reintentar Envio
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Registrar y Notificar
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
