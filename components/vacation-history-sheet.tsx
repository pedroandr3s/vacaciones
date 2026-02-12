"use client"

import type { EmployeeWithBalance } from "@/lib/types"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useData } from "@/contexts/data-context"
import { getAbsenceTypeLabel, parseLocalDate } from "@/lib/utils"

type Props = {
  employee: EmployeeWithBalance | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VacationHistorySheet({ employee, open, onOpenChange }: Props) {
  const { requests } = useData()

  if (!employee) return null

  // Get all approved vacation requests for this employee
  const vacationHistory = requests
    .filter((r) => r.employeeId === employee.id && r.status === "approved")
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Historial de Ausencias</SheetTitle>
          <SheetDescription>{employee.fullName}</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {vacationHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No hay registros de ausencias</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Fecha Fin</TableHead>
                  <TableHead className="text-center">Dias</TableHead>
                  <TableHead>Ausencia</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacationHistory.map((request) => {
                  const isLegal = request.legalDaysUsed > 0
                  const isNaitus = request.naitusDaysUsed > 0
                  const isUnpaid = request.absenceType === "permiso_sin_goce"

                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {parseLocalDate(request.startDate).toLocaleDateString("es-CL")}
                      </TableCell>
                      <TableCell>{parseLocalDate(request.endDate).toLocaleDateString("es-CL")}</TableCell>
                      <TableCell className="text-center font-semibold">{request.totalDays}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isUnpaid
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {getAbsenceTypeLabel(request.absenceType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isUnpaid ? (
                          <span className="text-xs text-orange-600">Sin descuento de saldo</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {isLegal && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Legal ({request.legalDaysUsed})
                              </Badge>
                            )}
                            {isNaitus && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Naitus ({request.naitusDaysUsed})
                              </Badge>
                            )}
                            {request.debtDaysUsed > 0 && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                Deuda ({request.debtDaysUsed})
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
