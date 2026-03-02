"use client"

import type React from "react"
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
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CalendarOff,
  AlertTriangle,
  Check,
  Info,
  Paperclip,
  X,
} from "lucide-react"
import {
  calculateVacationDaysWithHolidays,
  hasOverlappingRequests,
  getHolidayName,
  getTotalAvailable,
  parseLocalDate,
} from "@/lib/utils"
import { sendVacationToN8n, type N8nVacationPayload } from "@/lib/n8n-webhook"

type Props = {
  onLeaveRegistered?: () => void
  preselectedEmployeeId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  triggerButton?: boolean
}

export function AdminRegisterUnpaidLeaveDialog({
  onLeaveRegistered,
  preselectedEmployeeId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerButton = true,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const { employees, balances, requests: allRequests, holidays, addRequest } = useData()

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    preselectedEmployeeId || ""
  )
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [attachmentName, setAttachmentName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [webhookMessage, setWebhookMessage] = useState("")

  // Get employees with their balances - ONLY ACTIVE collaborators
  const employeesWithBalances: EmployeeWithBalance[] = useMemo(() => {
    return employees
      .filter((e) => e.role !== "admin" && e.status === "activo")
      .map((employee) => ({
        ...employee,
        balance: balances.find((b) => b.employeeId === employee.id),
      }))
  }, [employees, balances])

  // Selected employee data
  const selectedEmployee = useMemo(() => {
    return employeesWithBalances.find((e) => e.id === selectedEmployeeId)
  }, [employeesWithBalances, selectedEmployeeId])

  // Get existing requests for overlap validation
  const employeeRequests = useMemo(() => {
    if (!selectedEmployeeId) return []
    return allRequests.filter((r) => r.employeeId === selectedEmployeeId)
  }, [selectedEmployeeId, allRequests])

  // Calculate vacation days with holiday breakdown
  const daysCalculation = useMemo(() => {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) return null
    return calculateVacationDaysWithHolidays(start, end, holidays)
  }, [startDate, endDate, holidays])

  const businessDays = daysCalculation?.businessDaysToDeduct || 0

  // Security check: verify employee is active
  const isSelectedEmployeeActive = useMemo(() => {
    if (!selectedEmployeeId) return true
    const employee = employees.find((e) => e.id === selectedEmployeeId)
    return employee?.status === "activo"
  }, [selectedEmployeeId, employees])

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAttachmentName(file.name)
    }
  }

  const handleRemoveAttachment = () => {
    setAttachmentName("")
  }

  const handleSubmit = async () => {
    setError("")
    setSecurityError(null)

    if (!selectedEmployee || !startDate || !endDate || businessDays === 0) return

    // Validate reason
    if (!reason.trim()) {
      setError("Debe indicar un motivo para el permiso sin goce de sueldo")
      return
    }

    if (reason.trim().length < 10) {
      setError("El motivo debe tener al menos 10 caracteres")
      return
    }

    // Security check: verify collaborator has an active contract
    const employeeFromDB = employees.find(
      (e) => e.id === selectedEmployeeId
    )
    if (!employeeFromDB || employeeFromDB.status !== "activo") {
      setSecurityError(
        "Accion denegada: El colaborador seleccionado no posee un contrato vigente."
      )
      return
    }

    // Validate no overlap with existing approved requests
    const overlapCheck = hasOverlappingRequests(
      new Date(startDate),
      new Date(endDate),
      employeeRequests
    )

    if (overlapCheck.overlaps && overlapCheck.conflictingRequest) {
      const conflicting = overlapCheck.conflictingRequest
      const conflictStart = new Date(
        conflicting.startDate
      ).toLocaleDateString("es-CL")
      const conflictEnd = new Date(conflicting.endDate).toLocaleDateString(
        "es-CL"
      )
      const conflictType =
        conflicting.absenceType === "permiso_sin_goce"
          ? "un permiso sin goce"
          : "vacaciones aprobadas"
      setError(
        `Las fechas se solapan con ${conflictType} (${conflictStart} - ${conflictEnd}). Seleccione fechas distintas.`
      )
      return
    }

    setIsSubmitting(true)
    setWebhookStatus("sending")
    setWebhookMessage("")

    // Create the request record in Firestore
    const newRequest = {
      id: generateId("vacationRequests"),
      employeeId: selectedEmployee.id,
      absenceType: "permiso_sin_goce" as const,
      startDate,
      endDate,
      totalDays: businessDays,
      legalDaysUsed: 0,
      naitusDaysUsed: 0,
      debtDaysUsed: 0,
      status: "approved" as const,
      notes: [reason, notes].filter(Boolean).join(" | "),
      reviewedBy: "1",
      reviewedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    try {
      await addRequest(newRequest)
    } catch (err) {
      setError("Error al guardar el permiso. Intente nuevamente.")
      setIsSubmitting(false)
      setWebhookStatus("idle")
      return
    }

    // Build the n8n payload
    const ct = (selectedEmployee.contractType || "chile") as "chile" | "contractor_extranjero"
    const balance = selectedEmployee.balance
    const legalAvailable = balance ? balance.legalDays - balance.usedDays : 0
    const totalAvailable = balance
      ? getTotalAvailable(balance.legalDays, balance.naitusDays, balance.usedDays, balance.debtDays, ct)
      : 0

    const payload: N8nVacationPayload = {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.fullName,
      employeeEmail: selectedEmployee.email,
      employeePosition: selectedEmployee.position || "Colaborador",
      contractType: ct,
      leaveType: "permiso_sin_goce",
      startDate,
      endDate,
      totalBusinessDays: businessDays,
      notes: [reason, notes].filter(Boolean).join(" | "),
      balanceBefore: {
        legalDays: balance?.legalDays || 0,
        legalUsed: balance?.usedDays || 0,
        legalAvailable,
        naitusDays: balance?.naitusDays || 0,
        debtDays: balance?.debtDays || 0,
        totalAvailable,
      },
      balanceAfter: {
        legalConsumed: 0,
        naitusConsumed: 0,
        debtGenerated: 0,
        projectedLegal: legalAvailable,
        projectedNaitus: balance?.naitusDays || 0,
        projectedDebt: balance?.debtDays || 0,
        totalAvailableAfter: totalAvailable,
      },
      registeredBy: "admin",
      registeredAt: new Date().toISOString(),
    }

    // Show immediate feedback
    setWebhookMessage("Registrando evento en Google Calendar...")

    // Send to n8n (best-effort, leave already registered locally)
    const result = await sendVacationToN8n(payload)

    if (result.success) {
      setWebhookStatus("success")
      setWebhookMessage("✓ Permiso sin goce registrado correctamente. Evento agregado a Google Calendar y notificacion enviada al colaborador.")
    } else {
      setWebhookStatus("error")
      setWebhookMessage(`✓ Permiso sin goce registrado correctamente. Nota: ${result.message}`)
    }

    // Always close and refresh after a delay
    setTimeout(() => {
      setIsSubmitting(false)
      setWebhookStatus("idle")
      setWebhookMessage("")
      setOpen(false)
      resetForm()
      onLeaveRegistered?.()
    }, 2500)
  }

  const resetForm = () => {
    setSelectedEmployeeId(preselectedEmployeeId || "")
    setStartDate("")
    setEndDate("")
    setReason("")
    setNotes("")
    setAttachmentName("")
    setError("")
    setSecurityError(null)
    setWebhookStatus("idle")
    setWebhookMessage("")
  }

  // Update selectedEmployeeId when preselectedEmployeeId changes
  useMemo(() => {
    if (preselectedEmployeeId) {
      setSelectedEmployeeId(preselectedEmployeeId)
    }
  }, [preselectedEmployeeId])

  const canSubmit =
    selectedEmployeeId &&
    startDate &&
    endDate &&
    businessDays > 0 &&
    reason.trim().length >= 10 &&
    !isSubmitting &&
    isSelectedEmployeeActive

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-50 bg-transparent"
          >
            <CalendarOff className="h-4 w-4 mr-2" />
            Registrar Permiso sin Goce
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Permiso sin Goce de Sueldo</DialogTitle>
          <DialogDescription>
            Registre un permiso sin goce para un colaborador. Este permiso no
            afecta el saldo de vacaciones ni genera deuda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Info alert */}
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              Los permisos sin goce de sueldo{" "}
              <strong>no descuentan del saldo de vacaciones</strong> ni afectan
              los Dias Naitus. Durante este periodo el colaborador no recibira
              remuneracion.
            </AlertDescription>
          </Alert>

          {/* Security Error Alert */}
          {securityError && (
            <Alert className="bg-red-50 border-red-300">
              <AlertTriangle className="h-4 w-4 text-red-700" />
              <AlertDescription className="text-sm text-red-800 font-medium">
                {securityError}
              </AlertDescription>
            </Alert>
          )}

          {/* Validation error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Employee Selection */}
          <div className="space-y-2">
            <Label htmlFor="employee-unpaid">Seleccionar Colaborador</Label>
            <Select
              value={selectedEmployeeId}
              onValueChange={(val) => {
                setSelectedEmployeeId(val)
                setError("")
              }}
            >
              <SelectTrigger id="employee-unpaid">
                <SelectValue placeholder="Seleccione un colaborador" />
              </SelectTrigger>
              <SelectContent>
                {employeesWithBalances.map((emp) => {
                  const totalAvailable = emp.balance
                    ? getTotalAvailable(
                        emp.balance.legalDays,
                        emp.balance.naitusDays,
                        emp.balance.usedDays,
                        emp.balance.debtDays
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
                          {totalAvailable.toFixed(2)} dias vac.
                        </Badge>
                        {emp.contractType === "contractor_extranjero" && (
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
          {selectedEmployee && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {selectedEmployee.fullName}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedEmployee.position || "Colaborador"}
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-xs bg-orange-50 text-orange-700 border-orange-200"
              >
                Permiso sin goce
              </Badge>
            </div>
          )}

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate-unpaid">Fecha de Inicio</Label>
              <Input
                id="startDate-unpaid"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setError("")
                }}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate-unpaid">Fecha de Termino</Label>
              <Input
                id="endDate-unpaid"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setError("")
                }}
                min={startDate || new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          {/* Days calculation summary */}
          {daysCalculation && daysCalculation.totalCalendarDays > 0 && (
            <div className="border border-orange-200 rounded-lg overflow-hidden">
              {/* Resultado destacado */}
              <div className="flex items-center justify-center p-4 bg-orange-600 text-white">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider mb-1 text-orange-100">
                    Dias habiles del permiso
                  </p>
                  <p className="text-4xl font-bold">
                    {daysCalculation.businessDaysToDeduct}
                  </p>
                  <p className="text-xs text-orange-200 mt-1">
                    Sin descuento de saldo - sin remuneracion
                  </p>
                </div>
              </div>

              {/* Desglose */}
              <div className="p-4 bg-orange-50 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Desglose del periodo
                </p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between py-1.5 px-3 bg-white rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      <span className="text-sm text-slate-700">
                        Dias totales solicitados
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {daysCalculation.totalCalendarDays}
                    </span>
                  </div>

                  {daysCalculation.weekendDays > 0 && (
                    <div className="flex items-center justify-between py-1.5 px-3 bg-white rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        <span className="text-sm text-slate-600">
                          Fines de semana (no aplican)
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-slate-500">
                        -{daysCalculation.weekendDays}
                      </span>
                    </div>
                  )}

                  {daysCalculation.holidayCount > 0 && (
                    <div className="py-2 px-3 bg-white rounded border border-amber-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CalendarOff className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">
                            Feriados detectados
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-amber-700">
                          -{daysCalculation.holidayCount}
                        </span>
                      </div>
                      <ul className="ml-6 space-y-1">
                        {daysCalculation.holidaysInRange.map((date) => (
                          <li
                            key={date}
                            className="text-xs text-amber-700 flex items-center gap-1.5"
                          >
                            <span className="w-1 h-1 rounded-full bg-amber-400" />
                            <span>
                              {parseLocalDate(date).toLocaleDateString("es-CL", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              })}
                            </span>
                            <span className="text-amber-600">
                              ({getHolidayName(date, holidays)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason-unpaid">Motivo del permiso *</Label>
            <Textarea
              id="reason-unpaid"
              placeholder="Describa el motivo por el cual se solicita este permiso..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError("")
              }}
              rows={3}
              className={
                reason.length > 0 && reason.length < 10
                  ? "border-red-300"
                  : ""
              }
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-red-600">
                El motivo debe tener al menos 10 caracteres
              </p>
            )}
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label>Documento adjunto (opcional)</Label>
            {attachmentName ? (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                <Paperclip className="h-4 w-4 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-700 truncate flex-1">
                  {attachmentName}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                  onClick={handleRemoveAttachment}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleAttachmentChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Formatos: PDF, DOC, DOCX, JPG, PNG
                </p>
              </div>
            )}
          </div>

          {/* Additional notes */}
          <div className="space-y-2">
            <Label htmlFor="notes-unpaid">Notas adicionales (opcional)</Label>
            <Textarea
              id="notes-unpaid"
              placeholder="Informacion adicional relevante..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Impact summary */}
          {selectedEmployee && businessDays > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold text-green-800">
                  Sin impacto en el saldo
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-green-600">
                    Saldo de vacaciones actual
                  </p>
                  <p className="font-bold text-green-800">
                    {selectedEmployee.balance
                      ? getTotalAvailable(
                          selectedEmployee.balance.legalDays,
                          selectedEmployee.balance.naitusDays,
                          selectedEmployee.balance.usedDays,
                          selectedEmployee.balance.debtDays
                        ).toFixed(2)
                      : "0.0"}{" "}
                    dias
                  </p>
                </div>
                <div>
                  <p className="text-xs text-green-600">
                    Saldo despues del permiso
                  </p>
                  <p className="font-bold text-green-800">
                    {selectedEmployee.balance
                      ? getTotalAvailable(
                          selectedEmployee.balance.legalDays,
                          selectedEmployee.balance.naitusDays,
                          selectedEmployee.balance.usedDays,
                          selectedEmployee.balance.debtDays
                        ).toFixed(2)
                      : "0.0"}{" "}
                    dias
                  </p>
                </div>
              </div>
              <p className="text-xs text-green-700 mt-2">
                El saldo de vacaciones y los Dias Naitus se mantienen
                inalterados. No se genera deuda.
              </p>
            </div>
          )}

          {/* Webhook status feedback */}
          {webhookStatus === "sending" && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600 animate-pulse" />
              <AlertDescription className="text-blue-800 text-sm">
                Enviando datos al flujo de n8n...
              </AlertDescription>
            </Alert>
          )}
          {webhookStatus === "success" && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-sm">
                {webhookMessage}
              </AlertDescription>
            </Alert>
          )}
          {webhookStatus === "error" && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                {webhookMessage}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting ? (
              "Registrando..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Registrar Permiso
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
