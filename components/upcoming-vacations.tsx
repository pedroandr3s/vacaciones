"use client"

import { useMemo, useState } from "react"
import { useData } from "@/contexts/data-context"
import type { EmployeeWithBalance, VacationRequest } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  CalendarDays,
  Plane,
  Clock,
  ArrowRight,
  Users,
  AlertCircle,
  Palmtree,
  Briefcase,
} from "lucide-react"
import { getTotalAvailable, calculateContractorCycle, parseLocalDate } from "@/lib/utils"
import { EmployeeDetailSheet } from "@/components/employee-detail-sheet"

type VacationEntry = {
  employee: EmployeeWithBalance
  request: VacationRequest
  status: "en_curso" | "proxima" | "esta_semana"
  daysUntilStart: number
  daysRemaining: number
}

export function UpcomingVacations({ refreshKey }: { refreshKey?: number }) {
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithBalance | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const { employees, balances, requests } = useData()

  const entries = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result: VacationEntry[] = []

    const approvedRequests = requests.filter((r) => r.status === "approved")

    for (const request of approvedRequests) {
      const employee = employees.find((e) => e.id === request.employeeId && e.role === "employee")
      if (!employee) continue

      const start = parseLocalDate(request.startDate)
      const end = parseLocalDate(request.endDate)

      const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // En curso: today is within start-end range
      const isOngoing = today >= start && today <= end
      // Proxima en los proximos 60 dias
      const isUpcoming = daysUntilStart > 0 && daysUntilStart <= 60
      // Esta semana: starts within 7 days
      const isThisWeek = daysUntilStart > 0 && daysUntilStart <= 7

      if (!isOngoing && !isUpcoming) continue

      const balance = balances.find((b) => b.employeeId === employee.id)
      const currentRequests = requests.filter((r) => r.employeeId === employee.id && r.status === "approved")
      const employeeWithBalance: EmployeeWithBalance = { ...employee, balance, currentRequests }

      let status: VacationEntry["status"] = "proxima"
      if (isOngoing) status = "en_curso"
      else if (isThisWeek) status = "esta_semana"

      result.push({
        employee: employeeWithBalance,
        request,
        status,
        daysUntilStart: Math.max(0, daysUntilStart),
        daysRemaining: Math.max(0, daysRemaining),
      })
    }

    // Sort: ongoing first, then by start date
    result.sort((a, b) => {
      const statusOrder = { en_curso: 0, esta_semana: 1, proxima: 2 }
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status]
      }
      return new Date(a.request.startDate).getTime() - new Date(b.request.startDate).getTime()
    })

    return result
  }, [employees, balances, requests])

  const ongoingCount = entries.filter((e) => e.status === "en_curso").length
  const upcomingCount = entries.filter((e) => e.status !== "en_curso").length

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" })
  }

  const getStatusConfig = (status: VacationEntry["status"]) => {
    switch (status) {
      case "en_curso":
        return {
          label: "En vacaciones",
          bgCard: "bg-emerald-50 border-emerald-200",
          bgBadge: "bg-emerald-100 text-emerald-800 border-emerald-300",
          dotColor: "bg-emerald-500",
          icon: Palmtree,
          iconColor: "text-emerald-600",
        }
      case "esta_semana":
        return {
          label: "Esta semana",
          bgCard: "bg-amber-50 border-amber-200",
          bgBadge: "bg-amber-100 text-amber-800 border-amber-300",
          dotColor: "bg-amber-500",
          icon: Clock,
          iconColor: "text-amber-600",
        }
      case "proxima":
        return {
          label: "Proxima",
          bgCard: "bg-sky-50 border-sky-200",
          bgBadge: "bg-sky-100 text-sky-800 border-sky-300",
          dotColor: "bg-sky-500",
          icon: CalendarDays,
          iconColor: "text-sky-600",
        }
    }
  }

  const getAbsenceLabel = (type: string) => {
    return type === "permiso_sin_goce" ? "Permiso sin goce" : "Vacaciones"
  }

  const getAbsenceIcon = (type: string) => {
    return type === "permiso_sin_goce" ? Briefcase : Plane
  }

  const handleViewEmployee = (employee: EmployeeWithBalance) => {
    setSelectedEmployee(employee)
    setIsDetailOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <Palmtree className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">{ongoingCount}</span>
          <span className="text-sm text-emerald-700">en vacaciones ahora</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <CalendarDays className="h-4 w-4 text-sky-600" />
          <span className="text-sm font-semibold text-sky-800">{upcomingCount}</span>
          <span className="text-sm text-sky-700">proximas (60 dias)</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-slate-100 p-3 mb-3">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">No hay vacaciones en curso ni proximas</p>
            <p className="text-xs text-slate-400 mt-1">Las vacaciones registradas apareceran aqui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => {
            const config = getStatusConfig(entry.status)
            const StatusIcon = config.icon
            const AbsenceIcon = getAbsenceIcon(entry.request.absenceType)
            const contractType = entry.employee.contractType || "chile"
            const isContractor = contractType === "contractor_extranjero"
            const balance = entry.employee.balance
            const totalAvailable = balance
              ? getTotalAvailable(
                  balance.legalDays,
                  balance.naitusDays,
                  balance.usedDays,
                  balance.debtDays,
                  contractType as "chile" | "contractor_extranjero",
                )
              : 0

            return (
              <Card
                key={entry.request.id}
                className={`${config.bgCard} border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5`}
                onClick={() => handleViewEmployee(entry.employee)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-white text-slate-700 text-sm font-semibold">
                          {getInitials(entry.employee.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${config.dotColor}`}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm truncate">
                          {entry.employee.fullName}
                        </span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.bgBadge}`}>
                          <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600">
                        <AbsenceIcon className="h-3 w-3 flex-shrink-0" />
                        <span>{getAbsenceLabel(entry.request.absenceType)}</span>
                        <span className="text-slate-400 mx-0.5">|</span>
                        <span className="font-medium">
                          {formatDate(entry.request.startDate)}
                        </span>
                        <ArrowRight className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium">
                          {formatDate(entry.request.endDate)}
                        </span>
                        <span className="text-slate-400 mx-0.5">|</span>
                        <span>{entry.request.totalDays} dias</span>
                      </div>
                    </div>

                    {/* Right side: timing + balance */}
                    <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                      {/* Timing indicator */}
                      <div className="text-right">
                        {entry.status === "en_curso" ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-700">
                              {entry.daysRemaining === 0 ? "Ultimo dia" : `${entry.daysRemaining}d restantes`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-500">
                            {entry.daysUntilStart === 1 ? "Manana" : `en ${entry.daysUntilStart}d`}
                          </span>
                        )}
                      </div>

                      {/* Balance pill */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`rounded-full px-2.5 py-1 text-xs font-bold border ${
                                totalAvailable > 5
                                  ? "bg-white border-slate-200 text-slate-700"
                                  : totalAvailable > 0
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-red-50 border-red-200 text-red-700"
                              }`}
                            >
                              {totalAvailable > 0 ? `${totalAvailable.toFixed(1)}d` : `${totalAvailable.toFixed(1)}d`}
                              {totalAvailable <= 0 && (
                                <AlertCircle className="h-3 w-3 inline-block ml-0.5 -mt-0.5" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">Saldo disponible: {totalAvailable.toFixed(1)} dias</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <EmployeeDetailSheet
        employee={selectedEmployee}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  )
}
