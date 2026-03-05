"use client"

import type { VacationRequest } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Paperclip } from "lucide-react"
import { getAbsenceTypeLabel, parseLocalDate } from "@/lib/utils"

type Props = {
  requests: VacationRequest[]
}

export function MyVacationRequests({ requests }: Props) {
  const getStatusBadge = (status: VacationRequest["status"]) => {
    const variants = {
      pending: { variant: "outline" as const, label: "Pendiente", className: "border-yellow-500 text-yellow-700" },
      approved: { variant: "default" as const, label: "Aprobada", className: "bg-green-600" },
      rejected: { variant: "destructive" as const, label: "Rechazada", className: "" },
      cancelled: { variant: "secondary" as const, label: "Cancelada", className: "" },
    }
    return variants[status]
  }

  const sortedRequests = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-slate-600" />
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Mis Solicitudes</h2>
          <p className="text-sm text-slate-600">Historial de vacaciones y permisos</p>
        </div>
      </div>

      {sortedRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-muted-foreground">No tienes solicitudes de vacaciones</p>
            <p className="text-sm text-muted-foreground mt-1">Crea tu primera solicitud para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedRequests.map((request) => {
            const status = getStatusBadge(request.status)
            return (
              <Card key={request.id} className={`hover:shadow-md transition-shadow ${request.absenceType === "permiso_sin_goce" ? "border-orange-200" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {parseLocalDate(request.startDate).toLocaleDateString("es-CL", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        -{" "}
                        {parseLocalDate(request.endDate).toLocaleDateString("es-CL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </CardTitle>
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
                    </div>
                    <Badge variant={status.variant} className={status.className}>
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dias totales</span>
                    <span className="font-semibold text-slate-900">{request.totalDays.toFixed(2)} dias</span>
                  </div>

                  {request.absenceType === "vacacion_remunerada" ? (
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <div className="p-1.5 bg-blue-50 rounded text-center">
                        <p className="text-blue-700 font-medium">{request.legalDaysUsed.toFixed(2)}</p>
                        <p className="text-blue-600">Legal</p>
                      </div>
                      <div className="p-1.5 bg-green-50 rounded text-center">
                        <p className="text-green-700 font-medium">{request.naitusDaysUsed.toFixed(2)}</p>
                        <p className="text-green-600">Naitus</p>
                      </div>
                      <div className="p-1.5 bg-red-50 rounded text-center">
                        <p className="text-red-700 font-medium">{request.debtDaysUsed.toFixed(2)}</p>
                        <p className="text-red-600">Deuda</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-orange-50 rounded text-center text-xs">
                      <p className="text-orange-700 font-medium">Sin descuento de saldo</p>
                      <p className="text-orange-600 mt-0.5">No remunerado</p>
                    </div>
                  )}

                  {request.absenceType === "permiso_sin_goce" && request.reason && (
                    <div className="text-xs p-2 bg-slate-50 rounded">
                      <p className="font-medium text-slate-600 mb-0.5">Motivo:</p>
                      <p className="text-muted-foreground line-clamp-2">{request.reason}</p>
                    </div>
                  )}

                  {request.attachmentName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 p-2 bg-slate-50 rounded">
                      <Paperclip className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{request.attachmentName}</span>
                    </div>
                  )}

                  {request.absenceType === "vacacion_remunerada" && request.notes && (
                    <p className="text-xs text-muted-foreground p-2 bg-slate-50 rounded line-clamp-2">
                      {request.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                    <Clock className="h-3 w-3" />
                    <span>
                      {request.registeredBy === "employee"
                        ? `Solicitado el ${new Date(request.createdAt).toLocaleDateString("es-CL")}`
                        : "Creado por RRHH"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
