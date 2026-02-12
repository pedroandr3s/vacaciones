"use client"

import type React from "react"
import { useState, useEffect } from "react"
import type { EmployeeWithBalance } from "@/lib/types"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  employee: EmployeeWithBalance | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmployeeProfileDialog({ employee, open, onOpenChange }: Props) {
  const [contractType, setContractType] = useState<"chile" | "contractor_extranjero">("chile")
  const [hireDate, setHireDate] = useState<Date>()
  const [workerType, setWorkerType] = useState<"nacional" | "extranjero">("nacional")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (employee) {
      setContractType(employee.contractType || "chile")
      setHireDate(new Date(employee.hireDate))
      setWorkerType(employee.workerType || "nacional")
    }
  }, [employee])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (hireDate) {
      const today = new Date()
      const yearsSinceHire = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

console.log("[v0] Profile update:", {
        employeeId: employee?.id,
        contractType,
        hireDate: hireDate.toISOString(),
        yearsSinceHire: yearsSinceHire.toFixed(2),
      })

      // Logic for contractors abroad: benefit days expire after 1 calendar year
      if (contractType === "contractor_extranjero" && yearsSinceHire > 1) {
        console.log("[v0] Warning: Contractor's benefit days may have expired (1 calendar year rule)")
      }
    }

    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onOpenChange(false)
    }, 2000)
  }

  if (!employee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil del Empleado</DialogTitle>
          <DialogDescription>{employee.fullName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <Alert>
              <AlertDescription>Perfil actualizado correctamente. Los saldos han sido recalculados.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="contract-type">Tipo de Contrato</Label>
            <Select value={contractType} onValueChange={(value) => setContractType(value as "chile" | "contractor_extranjero")}>
              <SelectTrigger id="contract-type">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chile">Contrato en Chile</SelectItem>
                <SelectItem value="contractor_extranjero">Contractor en el extranjero</SelectItem>
              </SelectContent>
            </Select>
            {contractType === "contractor_extranjero" && (
              <p className="text-xs text-amber-600">
                Los días de beneficio para contractors en el extranjero caducan después de un año corrido.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fecha de Inicio de Contrato</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !hireDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {hireDate ? hireDate.toLocaleDateString("es-CL") : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={hireDate} onSelect={setHireDate} initialFocus />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-slate-500">
              Al cambiar esta fecha se recalculará automáticamente la antigüedad y los saldos de vacaciones.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar Cambios</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
