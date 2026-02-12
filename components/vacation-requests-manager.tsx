"use client"

import { useState, useMemo } from "react"
import type { VacationRequest } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { sendVacationToN8n, type N8nVacationPayload } from "@/lib/n8n-webhook"
import { getTotalAvailable } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Check, X, Calendar, Filter, Paperclip } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAbsenceTypeLabel } from "@/lib/utils"
import { hasOverlappingRequests } from "@/lib/utils" // Declare the variable before using it
import { useToast } from "@/hooks/use-toast"

export function VacationRequestsManager() {
  const { employees, balances, requests, updateRequest, updateBalance } = useData()
  const [actionResult, setActionResult] = useState<string | null>(null)
  const { toast } = useToast()
  
  // Filtros
  const [filterEmployee, setFilterEmployee] = useState<string>("all")
  const [filterYear, setFilterYear] = useState<string>("all")
  const [filterMonth, setFilterMonth] = useState<string>("all")
  const [filterAbsenceType, setFilterAbsenceType] = useState<string>("all")

  const handleApprove = async (requestId: string) => {
    const request = requests.find((r) => r.id === requestId)
    if (!request) return

    // Check for overlapping approved vacations before approving
    const employeeRequests = requests.filter((r) => r.employeeId === request.employeeId)
    const overlapCheck = hasOverlappingRequests(
      new Date(request.startDate),
      new Date(request.endDate),
      employeeRequests,
      requestId, // Exclude the current request being approved
      false // Only check approved requests, not pending
    )

    if (overlapCheck.overlaps && overlapCheck.conflictingRequest) {
      const conflict = overlapCheck.conflictingRequest
      const conflictType = getAbsenceTypeLabel(conflict.absenceType)
      setActionResult(
        `Error: El colaborador ya tiene una ausencia aprobada (${conflictType}) del ${conflict.startDate} al ${conflict.endDate} que se solapa con esta solicitud. No se puede aprobar.`
      )
      setTimeout(() => setActionResult(null), 6000)
      return
    }

    // Get employee and balance data for n8n webhook
    const employee = employees.find((e) => e.id === request.employeeId)
    const balance = balances.find((b) => b.employeeId === request.employeeId)
    
    if (!employee || !balance) {
      setActionResult("Error: No se encontraron datos del colaborador")
      setTimeout(() => setActionResult(null), 3000)
      return
    }

    const ct = (employee.contractType || "chile") as "chile" | "contractor_extranjero"
    const legalAvailable = balance.legalDays - balance.usedDays
    const totalAvailable = getTotalAvailable(balance.legalDays, balance.naitusDays, balance.usedDays, balance.debtDays, ct)

    // Update balance when approving
    const balanceUpdates: Record<string, unknown> = {
      usedDays: balance.usedDays + request.legalDaysUsed,
      updatedAt: new Date().toISOString(),
    }
    if (request.naitusDaysUsed > 0) {
      balanceUpdates.naitusDays = Math.max(0, balance.naitusDays - request.naitusDaysUsed)
    }
    if (request.debtDaysUsed > 0) {
      balanceUpdates.debtDays = (balance.debtDays || 0) - request.debtDaysUsed
    }

    try {
      await updateBalance(balance.id, balanceUpdates)
      await updateRequest(requestId, { status: "approved" as const, reviewedAt: new Date().toISOString(), reviewedBy: "1" })
    } catch (err) {
      setActionResult("Error al aprobar la solicitud. Intente nuevamente.")
      setTimeout(() => setActionResult(null), 4000)
      return
    }

    // Build n8n payload and send
    const payload: N8nVacationPayload = {
      employeeId: employee.id,
      employeeName: employee.fullName,
      employeeEmail: employee.email,
      employeePosition: employee.position || "Colaborador",
      contractType: ct,
      leaveType: request.absenceType === "permiso_sin_goce" ? "permiso_sin_goce" : "vacacion_remunerada",
      startDate: request.startDate,
      endDate: request.endDate,
      totalBusinessDays: request.totalDays,
      notes: request.notes || "",
      balanceBefore: {
        legalDays: balance.legalDays,
        legalUsed: balance.usedDays - request.legalDaysUsed,
        legalAvailable,
        naitusDays: balance.naitusDays + request.naitusDaysUsed,
        debtDays: balance.debtDays + request.debtDaysUsed,
        totalAvailable: totalAvailable + request.totalDays,
      },
      balanceAfter: {
        legalConsumed: request.legalDaysUsed,
        naitusConsumed: request.naitusDaysUsed,
        debtGenerated: request.debtDaysUsed,
        projectedLegal: legalAvailable - request.legalDaysUsed,
        projectedNaitus: balance.naitusDays,
        projectedDebt: balance.debtDays,
        totalAvailableAfter: totalAvailable,
      },
      registeredBy: "admin",
      registeredAt: new Date().toISOString(),
    }

    // Show immediate feedback
    setActionResult("Solicitud aprobada. Registrando evento en Google Calendar...")
    
    // Show initial toast
    toast({
      title: "Aprobando solicitud...",
      description: "Registrando evento en Google Calendar",
      variant: "default",
    })

    // Send to n8n (best-effort)
    const result = await sendVacationToN8n(payload)

    if (result.success) {
      setActionResult("✓ Solicitud aprobada correctamente. Evento registrado en Google Calendar y notificacion enviada al colaborador.")
      
      // Show success toast
      toast({
        title: "Solicitud aprobada correctamente",
        description: "Evento registrado en Google Calendar y notificacion enviada al colaborador.",
        variant: "default",
      })
    } else {
      setActionResult(`✓ Solicitud aprobada correctamente. Nota: ${result.message}`)
      
      // Show partial success toast
      toast({
        title: "Solicitud aprobada",
        description: "La solicitud fue aprobada, pero hubo un problema con la notificacion externa.",
        variant: "default",
      })
    }
    
    setTimeout(() => setActionResult(null), 5000)
  }

  const handleReject = async (requestId: string) => {
    try {
      await updateRequest(requestId, { status: "rejected" as const, reviewedAt: new Date().toISOString(), reviewedBy: "1" })
    } catch (err) {
      setActionResult("Error al rechazar la solicitud. Intente nuevamente.")
      setTimeout(() => setActionResult(null), 4000)
      return
    }
    setActionResult("✓ Solicitud rechazada correctamente. El colaborador sera notificado.")
    
    // Show rejection toast
    toast({
      title: "Solicitud rechazada",
      description: "La solicitud fue rechazada correctamente. El colaborador sera notificado.",
      variant: "destructive",
    })
    
    setTimeout(() => setActionResult(null), 4000)
  }

  const getEmployeeName = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.fullName || "Desconocido"
  }

  const getStatusBadge = (status: VacationRequest["status"]) => {
    const variants = {
      pending: { variant: "outline" as const, label: "Pendiente", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      approved: { variant: "default" as const, label: "Aprobada", className: "bg-green-100 text-green-700 border-green-200" },
      rejected: { variant: "destructive" as const, label: "Rechazada", className: "bg-red-100 text-red-700 border-red-200" },
      cancelled: { variant: "secondary" as const, label: "Cancelada", className: "bg-slate-100 text-slate-700 border-slate-200" },
    }
    return variants[status]
  }

  // Obtener años únicos de las solicitudes
  const uniqueYears = useMemo(() => {
    const years = new Set<string>()
    requests.forEach(r => {
      years.add(new Date(r.startDate).getFullYear().toString())
    })
    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [requests])

  // Meses del año
  const months = [
    { value: "0", label: "Enero" },
    { value: "1", label: "Febrero" },
    { value: "2", label: "Marzo" },
    { value: "3", label: "Abril" },
    { value: "4", label: "Mayo" },
    { value: "5", label: "Junio" },
    { value: "6", label: "Julio" },
    { value: "7", label: "Agosto" },
    { value: "8", label: "Septiembre" },
    { value: "9", label: "Octubre" },
    { value: "10", label: "Noviembre" },
    { value: "11", label: "Diciembre" },
  ]

  // Filtrar y ordenar solicitudes
  const filteredRequests = useMemo(() => {
    return requests
      .filter(r => {
        // Filtro por empleado
        if (filterEmployee !== "all" && r.employeeId !== filterEmployee) return false
        
        // Filtro por año
        const requestYear = new Date(r.startDate).getFullYear().toString()
        if (filterYear !== "all" && requestYear !== filterYear) return false
        
        // Filtro por mes
        const requestMonth = new Date(r.startDate).getMonth().toString()
        if (filterMonth !== "all" && requestMonth !== filterMonth) return false

        // Filtro por tipo de ausencia
        if (filterAbsenceType !== "all" && r.absenceType !== filterAbsenceType) return false
        
        return true
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
  }, [requests, filterEmployee, filterYear, filterMonth, filterAbsenceType])

  const clearFilters = () => {
    setFilterEmployee("all")
    setFilterYear("all")
    setFilterMonth("all")
    setFilterAbsenceType("all")
  }

  const hasActiveFilters = filterEmployee !== "all" || filterYear !== "all" || filterMonth !== "all" || filterAbsenceType !== "all"

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Solicitudes y Permisos</h2>
        <p className="text-sm text-slate-600">Registro de vacaciones y permisos sin goce de sueldo</p>
      </div>

      {actionResult && (
        <Alert className={`border-2 ${
          actionResult.includes("Error") || actionResult.includes("fallo") 
            ? "bg-red-50 border-red-200" 
            : actionResult.includes("Registrando")
            ? "bg-blue-50 border-blue-200"
            : "bg-green-50 border-green-200"
        }`}>
          <AlertDescription className={`font-medium ${
            actionResult.includes("Error") || actionResult.includes("fallo")
              ? "text-red-800"
              : actionResult.includes("Registrando")
              ? "text-blue-800"
              : "text-green-800"
          }`}>
            {actionResult}
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Filtros:</span>
            </div>
            
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los colaboradores</SelectItem>
                {employees.filter(e => e.role !== "admin").map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAbsenceType} onValueChange={setFilterAbsenceType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="vacacion_remunerada">Vacaciones</SelectItem>
                <SelectItem value="permiso_sin_goce">Permiso sin goce</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de solicitudes */}
      <Card>
        <CardContent className="p-0">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">No hay solicitudes que coincidan con los filtros</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold">Colaborador</TableHead>
                  <TableHead className="text-xs font-semibold">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold">Fechas</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Total</TableHead>
                  <TableHead className="text-xs font-semibold text-center text-blue-700">Legales</TableHead>
                  <TableHead className="text-xs font-semibold text-center text-green-700">Naitus</TableHead>
                  <TableHead className="text-xs font-semibold text-center text-red-700">Deuda</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Estado</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request, index) => {
                  const status = getStatusBadge(request.status)
                  return (
                    <TableRow 
                      key={request.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-slate-900">
                            {getEmployeeName(request.employeeId)}
                          </p>
                          {request.absenceType === "permiso_sin_goce" && request.reason && (
                            <p className="text-xs text-slate-500 truncate max-w-[150px]">
                              {request.reason}
                            </p>
                          )}
                          {request.absenceType === "vacacion_remunerada" && request.notes && (
                            <p className="text-xs text-slate-500 truncate max-w-[150px]">
                              {request.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={
                              request.absenceType === "permiso_sin_goce"
                                ? "bg-orange-50 text-orange-700 border-orange-200 text-[11px]"
                                : "bg-blue-50 text-blue-700 border-blue-200 text-[11px]"
                            }
                          >
                            {getAbsenceTypeLabel(request.absenceType)}
                          </Badge>
                          {request.attachmentName && (
                            <Paperclip className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          <p className="font-medium">
                            {new Date(request.startDate).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                            {" - "}
                            {new Date(request.endDate).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(request.startDate).getFullYear()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-slate-900">{request.totalDays}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-blue-700">{request.legalDaysUsed}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-green-700">{request.naitusDaysUsed}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-medium ${request.debtDaysUsed > 0 ? "text-red-700" : "text-slate-400"}`}>
                          {request.debtDaysUsed > 0 ? request.debtDaysUsed : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(request.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleReject(request.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="flex items-center justify-between text-sm text-slate-500 flex-wrap gap-2">
        <span>
          Mostrando {filteredRequests.length} de {requests.length} solicitudes
        </span>
        <div className="flex items-center gap-3">
          <span>
            Pendientes: {filteredRequests.filter(r => r.status === "pending").length} | 
            Aprobadas: {filteredRequests.filter(r => r.status === "approved").length} | 
            Rechazadas: {filteredRequests.filter(r => r.status === "rejected").length}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-blue-600">
            Vacaciones: {filteredRequests.filter(r => r.absenceType === "vacacion_remunerada").length}
          </span>
          <span className="text-orange-600">
            Sin goce: {filteredRequests.filter(r => r.absenceType === "permiso_sin_goce").length}
          </span>
        </div>
      </div>
    </div>
  )
}
