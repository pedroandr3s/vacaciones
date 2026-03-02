"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, AlertTriangle, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn, calculateBusinessDays, hasOverlappingRequests, getAbsenceTypeLabel } from "@/lib/utils"
import { useData } from "@/contexts/data-context"
import { generateId } from "@/lib/firebase-services"
import { useToast } from "@/hooks/use-toast"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  legalAvailable: number
  naitusAvailable: number
  employeeId?: string
  employeeName?: string
  employeeEmail?: string
  employeePosition?: string
  contractType?: "chile" | "contractor_extranjero"
  legalDaysTotal?: number
  legalUsed?: number
  naitusDaysTotal?: number
  debtDays?: number
  onVacationRegistered?: () => void
}

export function VacationRequestDialog({
  open,
  onOpenChange,
  legalAvailable,
  naitusAvailable,
  employeeId = "",
  employeeName = "",
  employeeEmail = "",
  employeePosition = "",
  contractType = "chile",
  legalDaysTotal = 0,
  legalUsed = 0,
  naitusDaysTotal = 0,
  debtDays = 0,
  onVacationRegistered,
}: Props) {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [notes, setNotes] = useState("")
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const { requests: allRequests, addRequest } = useData()

  const requestedDays = startDate && endDate ? calculateBusinessDays(startDate, endDate) : 0
  const totalAvailable = legalAvailable + naitusAvailable
  const willHaveDebt = requestedDays > totalAvailable
  const debtAmount = willHaveDebt ? requestedDays - totalAvailable : 0

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date)
    if (date && endDate && endDate < date) {
      setEndDate(undefined)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!startDate || !endDate) {
      setError("Debe seleccionar fechas de inicio y fin")
      return
    }

    if (startDate > endDate) {
      setError("La fecha de inicio debe ser anterior a la fecha de fin")
      return
    }

    // Check for overlapping vacations (approved or pending)
    const employeeRequests = allRequests.filter((r) => r.employeeId === employeeId)
    const overlapCheck = hasOverlappingRequests(startDate, endDate, employeeRequests, undefined, true)
    if (overlapCheck.overlaps && overlapCheck.conflictingRequest) {
      const conflict = overlapCheck.conflictingRequest
      const conflictType = getAbsenceTypeLabel(conflict.absenceType)
      const conflictStatus = conflict.status === "pending" ? "pendiente" : "aprobada"
      setError(
        `Ya existe una ausencia ${conflictStatus} (${conflictType}) del ${conflict.startDate} al ${conflict.endDate} que se solapa con el periodo solicitado. No se pueden programar ausencias simultaneas.`
      )
      return
    }

    setIsSubmitting(true)

    // Calculate how days would be consumed (for display in the request)
    const legalConsumed = Math.min(requestedDays, legalAvailable)
    const remainingAfterLegal = requestedDays - legalConsumed
    const naitusConsumed = Math.min(remainingAfterLegal, naitusAvailable)
    const debtGenerated = Math.max(0, remainingAfterLegal - naitusConsumed)

    // Create a vacation request record with PENDING status
    // Balance will be updated ONLY when admin approves
    const newRequest = {
      id: generateId("vacationRequests"),
      employeeId,
      absenceType: "vacacion_remunerada" as const,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      totalDays: requestedDays,
      legalDaysUsed: legalConsumed,
      naitusDaysUsed: naitusConsumed,
      debtDaysUsed: debtGenerated,
      status: "pending" as const,
      notes: notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      await addRequest(newRequest)
      setSuccess(true)
      
      toast({
        title: "Solicitud enviada correctamente",
        description: "Tu solicitud de vacaciones esta pendiente de aprobacion por el administrador.",
        variant: "default",
      })
      
      setTimeout(() => {
        setSuccess(false)
        setIsSubmitting(false)
        onOpenChange(false)
        setStartDate(undefined)
        setEndDate(undefined)
        setNotes("")
        onVacationRegistered?.()
      }, 1500)
    } catch (err) {
      console.error("[VacationRequestDialog] Error al guardar solicitud:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Error al guardar la solicitud: ${msg}`)
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Vacaciones</DialogTitle>
          <DialogDescription>Seleccione el rango de fechas para sus vacaciones</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {success && (
            <Alert className="bg-green-50 border-green-200 border-2">
              <AlertDescription className="text-green-800 font-medium">
                ✓ Solicitud de vacaciones enviada correctamente. Tu solicitud esta pendiente de aprobacion por el administrador.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Fecha de Inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleStartDateSelect}
                  initialFocus
                  locale={es}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Fecha de Fin</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                  disabled={!startDate}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  locale={es}
                  disabled={(date) => {
                    if (!startDate) return true
                    return date < startDate
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {requestedDays > 0 && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-900 font-medium">Días solicitados:</span>
                <span className="text-blue-900 font-bold">{requestedDays} días</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-700">Disponibles:</span>
                <span className="text-blue-700">{totalAvailable.toFixed(2)} días</span>
              </div>
            </div>
          )}

          {willHaveDebt && requestedDays > 0 && (
            <Alert className="bg-amber-50 border-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                <strong>Atención:</strong> Estás solicitando {debtAmount.toFixed(2)} días más de los que tienes
                disponibles. Si se aprueba, quedarás con un saldo en deuda de{" "}
                <strong className="text-amber-700">-{debtAmount.toFixed(2)} días</strong>.
                <p className="mt-2 text-xs text-amber-800">
                  Toda solicitud (con saldo a favor o en deuda) está sujeta a la aprobación de la jefatura.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Motivo de las vacaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!startDate || !endDate || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Solicitar Vacaciones"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
