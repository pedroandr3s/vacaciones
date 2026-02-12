"use client"

import type React from "react"

import { useState } from "react"
import type { EmployeeWithBalance } from "@/lib/types"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"

type Props = {
  employee: EmployeeWithBalance | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BalanceAdjustmentDialog({ employee, open, onOpenChange }: Props) {
  const [legalDays, setLegalDays] = useState("")
  const [naitusDays, setNaitusDays] = useState("")
  const [debtDays, setDebtDays] = useState("")
  const [notes, setNotes] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, this would call an API to update the balance
    console.log("[v0] Balance adjustment:", {
      employeeId: employee?.id,
      legalDays,
      naitusDays,
      debtDays,
      notes,
    })
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onOpenChange(false)
      // Reset form
      setLegalDays("")
      setNaitusDays("")
      setDebtDays("")
      setNotes("")
    }, 2000)
  }

  if (!employee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Saldo de Vacaciones</DialogTitle>
          <DialogDescription>{employee.fullName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <Alert>
              <AlertDescription>Saldo actualizado correctamente</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="legal-days">Días Legales (actual: {employee.balance?.legalDays || 0})</Label>
            <Input
              id="legal-days"
              type="number"
              step="0.5"
              placeholder="15.0"
              value={legalDays}
              onChange={(e) => setLegalDays(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="naitus-days">Días Naitus (actual: {employee.balance?.naitusDays || 0})</Label>
            <Input
              id="naitus-days"
              type="number"
              step="0.5"
              placeholder="5.0"
              value={naitusDays}
              onChange={(e) => setNaitusDays(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-days">Días Deuda (actual: {employee.balance?.debtDays || 0})</Label>
            <Input
              id="debt-days"
              type="number"
              step="0.5"
              placeholder="0.0"
              value={debtDays}
              onChange={(e) => setDebtDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Use valores negativos para deudas</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Razón del ajuste..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar Ajuste</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
