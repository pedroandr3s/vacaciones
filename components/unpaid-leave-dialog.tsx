"use client"

import type React from "react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, AlertTriangle, Paperclip, Info, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn, calculateBusinessDays, hasOverlappingRequests, parseLocalDate } from "@/lib/utils"
import { useData } from "@/contexts/data-context"
import { generateId } from "@/lib/firebase-services"
import type { VacationRequest } from "@/lib/types"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  existingRequests?: VacationRequest[]
}

export function UnpaidLeaveDialog({
  open,
  onOpenChange,
  employeeId,
  existingRequests,
}: Props) {
  const { requests: allFirestoreRequests, addRequest } = useData()
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [attachmentName, setAttachmentName] = useState("")
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allRequests = existingRequests || allFirestoreRequests.filter((r) => r.employeeId === employeeId)
  const requestedDays =
    startDate && endDate ? calculateBusinessDays(startDate, endDate) : 0

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date)
    if (date && endDate && endDate < date) {
      setEndDate(undefined)
    }
  }

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAttachmentName(file.name)
    }
  }

  const handleRemoveAttachment = () => {
    setAttachmentName("")
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

    if (!reason.trim()) {
      setError(
        "Debe indicar un motivo para el permiso sin goce de sueldo"
      )
      return
    }

    if (reason.trim().length < 10) {
      setError("El motivo debe tener al menos 10 caracteres")
      return
    }

    // Validate no overlap with existing approved/pending requests
    const overlapCheck = hasOverlappingRequests(
      startDate,
      endDate,
      allRequests,
      undefined,
      true
    )

    if (overlapCheck.overlaps && overlapCheck.conflictingRequest) {
      const conflicting = overlapCheck.conflictingRequest
      const conflictStart = parseLocalDate(
        conflicting.startDate
      ).toLocaleDateString("es-CL")
      const conflictEnd = parseLocalDate(
        conflicting.endDate
      ).toLocaleDateString("es-CL")
      setError(
        `Las fechas se solapan con una ausencia existente (${conflictStart} - ${conflictEnd}). Seleccione fechas distintas.`
      )
      return
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    const newRequest: VacationRequest = {
      id: generateId("vacationRequests"),
      employeeId,
      absenceType: "permiso_sin_goce",
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      totalDays: requestedDays,
      legalDaysUsed: 0,
      naitusDaysUsed: 0,
      debtDaysUsed: 0,
      status: "pending",
      registeredBy: "employee",
      reason: reason.trim(),
      notes: notes || "",
      attachmentName: attachmentName || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      await addRequest(newRequest)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setIsSubmitting(false)
        onOpenChange(false)
        resetForm()
      }, 2000)
    } catch (err) {
      setIsSubmitting(false)
      setError("Error al enviar la solicitud. Intente nuevamente.")
    }
  }

  const resetForm = () => {
    setStartDate(undefined)
    setEndDate(undefined)
    setReason("")
    setNotes("")
    setAttachmentName("")
    setError("")
    setIsSubmitting(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Permiso sin Goce de Sueldo</DialogTitle>
          <DialogDescription>
            Este permiso no descuenta de su saldo de vacaciones. No sera
            remunerado durante los dias solicitados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                Solicitud de permiso sin goce creada correctamente
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Info alert */}
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              Los permisos sin goce de sueldo <strong>no afectan</strong>{" "}
              su saldo de vacaciones ni dias Naitus. Sin embargo, durante
              este periodo no recibira remuneracion.
            </AlertDescription>
          </Alert>

          {/* Date pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha de Inicio *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "dd/MM/yyyy", { locale: es })
                      : "Inicio"}
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
              <Label>Fecha de Fin *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                    disabled={!startDate}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, "dd/MM/yyyy", { locale: es })
                      : "Fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    key={startDate?.toISOString()}
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    defaultMonth={startDate || undefined}
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
          </div>

          {/* Days summary */}
          {requestedDays > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-900 font-medium">
                  Dias habiles solicitados:
                </span>
                <span className="text-orange-900 font-bold text-lg">
                  {requestedDays} {requestedDays === 1 ? "dia" : "dias"}
                </span>
              </div>
              <p className="text-xs text-orange-700 mt-1">
                Sin descuento del saldo de vacaciones - sin remuneracion
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo del permiso *</Label>
            <Textarea
              id="reason"
              placeholder="Describa el motivo por el cual solicita este permiso..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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

          {/* TODO: Habilitar cuando Firebase Storage esté activado
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
              <div className="relative">
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
          */}

          {/* Additional notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas adicionales (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Informacion adicional relevante..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!startDate || !endDate || !reason.trim() || isSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Solicitar Permiso
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
