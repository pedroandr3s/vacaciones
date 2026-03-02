"use client"

import { useMemo } from "react"
import { getTotalAvailable, parseLocalDate, getEffectiveNaitusDays } from "@/lib/utils"
import { useData } from "@/contexts/data-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Palmtree,
  Calendar,
  ArrowRight,
  Briefcase,
  Plane,
  CalendarHeart,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface AdminDashboardOverviewProps {
  refreshKey?: number
  onNavigateTab?: (tab: string) => void
}

export function AdminDashboardOverview({ refreshKey, onNavigateTab }: AdminDashboardOverviewProps) {
  const { employees, balances, requests, holidays } = useData()

  const stats = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.role === "employee" && e.status === "activo")
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Vacaciones activas y proximas
    const onVacationNow: { employee: (typeof activeEmployees)[0]; request: (typeof requests)[0]; daysRemaining: number }[] = []
    const upcomingVacations: { employee: (typeof activeEmployees)[0]; request: (typeof requests)[0]; daysUntilStart: number }[] = []
    const approvedRequests = requests.filter((r) => r.status === "approved")

    for (const req of approvedRequests) {
      const emp = activeEmployees.find((e) => e.id === req.employeeId)
      if (!emp) continue
      const start = parseLocalDate(req.startDate)
      const end = parseLocalDate(req.endDate)

      if (today >= start && today <= end) {
        const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        onVacationNow.push({ employee: emp, request: req, daysRemaining })
      } else {
        const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilStart > 0 && daysUntilStart <= 60) {
          upcomingVacations.push({ employee: emp, request: req, daysUntilStart })
        }
      }
    }
    upcomingVacations.sort((a, b) => a.daysUntilStart - b.daysUntilStart)

    const pendingRequests = requests.filter((r) => r.status === "pending")

    // Balance data -- sorted by highest available first
    const balanceData = activeEmployees.map((emp) => {
      const balance = balances.find((b) => b.employeeId === emp.id)
      const ct = (emp.contractType || "chile") as "chile" | "contractor_extranjero"
      const totalAvail = balance ? getTotalAvailable(balance.legalDays, balance.naitusDays, balance.usedDays, balance.debtDays, ct) : 0
      const totalCapacity = (balance?.legalDays || 0) + (balance && balance.naitusDays > 0 ? balance.naitusDays : 0)
      const usedDays = balance?.usedDays || 0
      const legalDaysTotal = balance?.legalDays || 0
      const naitusDaysRaw = balance?.naitusDays || 0
      const availableLegal = Math.max(0, legalDaysTotal - usedDays)
      const availableNaitus = balance
        ? getEffectiveNaitusDays(balance, ct)
        : 0

      return {
        id: emp.id,
        name: emp.fullName.split(" ").slice(0, 2).join(" "),
        shortName: emp.fullName.split(" ")[0],
        totalAvailable: Math.round(totalAvail * 10) / 10,
        usedDays,
        availableLegal: Math.round(availableLegal * 10) / 10,
        availableNaitus: Math.round(availableNaitus * 10) / 10,
        legalDays: legalDaysTotal,
        naitusDays: naitusDaysRaw,
        debtDays: balance?.debtDays || 0,
        totalCapacity,
        contractType: ct,
      }
    }).sort((a, b) => b.totalAvailable - a.totalAvailable)

    // Statistics
    const totalAvailableAll = balanceData.reduce((s, e) => s + e.totalAvailable, 0)
    const totalUsedAll = balanceData.reduce((s, e) => s + e.usedDays, 0)
    const totalCapacityAll = balanceData.reduce((s, e) => s + e.totalCapacity, 0)
    const avgAvailable = activeEmployees.length > 0 ? Math.round((totalAvailableAll / activeEmployees.length) * 10) / 10 : 0
    const usagePercentage = totalCapacityAll > 0 ? Math.round((totalUsedAll / totalCapacityAll) * 100) : 0
    const employeesWithDebt = balanceData.filter((e) => e.debtDays < 0).length

    const chileCount = activeEmployees.filter((e) => e.contractType === "chile").length
    const contractorCount = activeEmployees.filter((e) => e.contractType === "contractor_extranjero").length

    // Feriados proximos
    const upcomingHolidays = holidays
      .filter((h) => {
        const hDate = parseLocalDate(h.date)
        const diff = Math.ceil((hDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return diff >= 0 && diff <= 120
      })
      .map((h) => {
        const hDate = parseLocalDate(h.date)
        const daysUntil = Math.ceil((hDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return { ...h, daysUntil }
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)

    const totalHolidaysYear = holidays.length
    const remainingHolidays = holidays.filter((h) => {
      const hDate = parseLocalDate(h.date)
      return hDate >= today
    }).length

    return {
      activeEmployees,
      onVacationNow,
      upcomingVacations,
      pendingRequests,
      balanceData,
      chileCount,
      contractorCount,
      avgAvailable,
      usagePercentage,
      employeesWithDebt,
      totalUsedAll,
      totalCapacityAll,
      upcomingHolidays,
      totalHolidaysYear,
      remainingHolidays,
    }
  }, [employees, balances, requests, holidays])

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "short" })

  const formatDateLong = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })

  const totalVacationEvents = stats.onVacationNow.length + stats.upcomingVacations.length

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active employees */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2.5">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900">{stats.activeEmployees.length}</p>
                <p className="text-xs text-slate-500">Colaboradores activos</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                {stats.chileCount} Chile
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                {stats.contractorCount} Contractor
              </span>
            </div>
          </CardContent>
        </Card>

        {/* On vacation now */}
        <Card className={`border-slate-200 ${stats.onVacationNow.length > 0 ? "ring-1 ring-emerald-200" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${stats.onVacationNow.length > 0 ? "bg-emerald-100" : "bg-slate-100"}`}>
                <Palmtree className={`h-5 w-5 ${stats.onVacationNow.length > 0 ? "text-emerald-600" : "text-slate-600"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900">{stats.onVacationNow.length}</p>
                <p className="text-xs text-slate-500">Ausencias hoy</p>
              </div>
            </div>
            {stats.onVacationNow.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-emerald-700 truncate">
                  {stats.onVacationNow.map((v) => v.employee.fullName.split(" ")[0]).join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending requests */}
        <Card className={`border-slate-200 ${stats.pendingRequests.length > 0 ? "ring-1 ring-amber-200" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${stats.pendingRequests.length > 0 ? "bg-amber-100" : "bg-slate-100"}`}>
                <Calendar className={`h-5 w-5 ${stats.pendingRequests.length > 0 ? "text-amber-600" : "text-slate-600"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900">{stats.pendingRequests.length}</p>
                <p className="text-xs text-slate-500">Solicitudes pendientes</p>
              </div>
            </div>
            {stats.pendingRequests.length > 0 ? (
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0 text-xs text-amber-700 hover:text-amber-900"
                onClick={() => onNavigateTab?.("requests")}
              >
                Revisar solicitudes
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Sin pendientes</p>
            )}
          </CardContent>
        </Card>

        {/* Avg available days */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-100 p-2.5">
                <TrendingUp className="h-5 w-5 text-sky-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900">{stats.avgAvailable}</p>
                <p className="text-xs text-slate-500">Promedio dias disponibles</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                {stats.usagePercentage}% uso global
              </span>
              {stats.employeesWithDebt > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                  {stats.employeesWithDebt} con deuda
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main section: Vacaciones + Feriados side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vacaciones activas y proximas -- 2 cols */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900">Ausencias activas y proximas</CardTitle>
                <CardDescription className="text-xs">Vacaciones y permisos sin goce en los proximos 60 dias</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {stats.onVacationNow.length > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                    {stats.onVacationNow.length} activas
                  </Badge>
                )}
                {stats.upcomingVacations.length > 0 && (
                  <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px]">
                    {stats.upcomingVacations.length} proximas
                  </Badge>
                )}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => onNavigateTab?.("calendar")}
                >
                  Ver calendario
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {totalVacationEvents === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-slate-100 p-4 mb-3">
                  <Palmtree className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">Sin ausencias programadas</p>
                <p className="text-xs text-slate-400 mt-1">No hay vacaciones ni permisos en los proximos 60 dias</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {/* Active absences */}
                {stats.onVacationNow.map((v) => {
                  const isUnpaid = v.request.absenceType === "permiso_sin_goce"
                  return (
                    <div
                      key={v.request.id}
                      className={`flex items-center gap-3 rounded-lg border p-3.5 ${
                        isUnpaid
                          ? "bg-orange-50 border-orange-200"
                          : "bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className={`h-9 w-9 border-2 shadow-sm ${isUnpaid ? "border-orange-300" : "border-emerald-300"}`}>
                          <AvatarFallback className="bg-white text-slate-700 text-xs font-semibold">
                            {getInitials(v.employee.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                          isUnpaid ? "bg-orange-500" : "bg-emerald-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{v.employee.fullName}</p>
                          <Badge className={`text-[9px] px-1.5 py-0 h-4 ${
                            isUnpaid
                              ? "bg-orange-100 text-orange-700 border-orange-300"
                              : "bg-emerald-100 text-emerald-700 border-emerald-300"
                          }`}>
                            {isUnpaid ? "Sin goce" : "Vacaciones"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          {isUnpaid ? (
                            <Briefcase className="h-3 w-3 flex-shrink-0 text-orange-600" />
                          ) : (
                            <Plane className="h-3 w-3 flex-shrink-0 text-emerald-600" />
                          )}
                          <span>{formatDate(v.request.startDate)}</span>
                          <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
                          <span>{formatDate(v.request.endDate)}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                          isUnpaid ? "bg-orange-100" : "bg-emerald-100"
                        }`}>
                          <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                            isUnpaid ? "bg-orange-500" : "bg-emerald-500"
                          }`} />
                          <span className={`text-xs font-medium ${isUnpaid ? "text-orange-700" : "text-emerald-700"}`}>
                            {v.daysRemaining === 0 ? "Ultimo dia" : `${v.daysRemaining}d restantes`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Upcoming absences */}
                {stats.upcomingVacations.map((v) => {
                  const isThisWeek = v.daysUntilStart <= 7
                  const isUnpaid = v.request.absenceType === "permiso_sin_goce"
                  return (
                    <div
                      key={v.request.id}
                      className={`flex items-center gap-3 rounded-lg border p-3.5 ${
                        isThisWeek ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className={`h-9 w-9 border-2 shadow-sm ${isThisWeek ? "border-amber-300" : "border-slate-300"}`}>
                          <AvatarFallback className="bg-white text-slate-700 text-xs font-semibold">
                            {getInitials(v.employee.fullName)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{v.employee.fullName}</p>
                          <Badge className={`text-[9px] px-1.5 py-0 h-4 ${
                            isUnpaid
                              ? "bg-orange-100 text-orange-700 border-orange-300"
                              : "bg-blue-100 text-blue-700 border-blue-300"
                          }`}>
                            {isUnpaid ? "Sin goce" : "Vacaciones"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          {isUnpaid ? (
                            <Briefcase className="h-3 w-3 flex-shrink-0 text-orange-600" />
                          ) : (
                            <Plane className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span>{formatDate(v.request.startDate)}</span>
                          <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
                          <span>{formatDate(v.request.endDate)}</span>
                          <span className="text-slate-400">({v.request.totalDays}d)</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          isThisWeek
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {v.daysUntilStart === 1 ? "Manana" : `en ${v.daysUntilStart}d`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feriados proximos -- 1 col */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <CalendarHeart className="h-4 w-4 text-rose-500" />
                  Feriados
                </CardTitle>
                <CardDescription className="text-xs">Proximos 4 meses</CardDescription>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-slate-500 hover:text-slate-700"
                onClick={() => onNavigateTab?.("holidays")}
              >
                Ver todos
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs text-rose-700 font-medium">
                {stats.remainingHolidays} restantes en {new Date().getFullYear()}
              </span>
              <span className="text-[10px] text-slate-400">
                de {stats.totalHolidaysYear} totales
              </span>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {stats.upcomingHolidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarHeart className="h-6 w-6 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">Sin feriados proximos</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {stats.upcomingHolidays.map((h, idx) => {
                  const isToday = h.daysUntil === 0
                  const isThisWeek = h.daysUntil <= 7 && h.daysUntil > 0
                  return (
                    <div
                      key={h.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                        isToday ? "bg-rose-50 border border-rose-200" :
                        isThisWeek ? "bg-amber-50 border border-amber-100" :
                        idx === 0 ? "bg-slate-50 border border-slate-150" :
                        "border border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className={`flex flex-col items-center justify-center rounded-lg h-10 w-10 flex-shrink-0 text-center ${
                        isToday ? "bg-rose-100 text-rose-700" :
                        isThisWeek ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        <span className="text-sm font-bold leading-none">{parseLocalDate(h.date).getDate()}</span>
                        <span className="text-[9px] uppercase leading-none mt-0.5">
                          {parseLocalDate(h.date).toLocaleDateString("es-CL", { month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">{h.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{formatDateLong(h.date)}</p>
                      </div>
                      <span className={`text-[10px] font-medium flex-shrink-0 ${
                        isToday ? "text-rose-600" :
                        isThisWeek ? "text-amber-600" :
                        "text-slate-400"
                      }`}>
                        {isToday ? "Hoy" : h.daysUntil === 1 ? "Manana" : `${h.daysUntil}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Top balances + Usage stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top accumulated balances -- ranked list */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">Mayor saldo acumulado</CardTitle>
                <CardDescription className="text-xs">Colaboradores con mas dias disponibles</CardDescription>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-slate-500 hover:text-slate-700"
                onClick={() => onNavigateTab?.("employees")}
              >
                Ver todos
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
              {stats.balanceData.map((emp, idx) => {
                const fillPercent = stats.balanceData[0].totalAvailable > 0
                  ? Math.min(100, Math.round((emp.totalAvailable / stats.balanceData[0].totalAvailable) * 100))
                  : 0
                return (
                  <div
                    key={emp.id}
                    className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    {/* Rank */}
                    <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold flex-shrink-0 ${
                      idx === 0 ? "bg-emerald-100 text-emerald-700" :
                      idx === 1 ? "bg-sky-100 text-sky-700" :
                      idx === 2 ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {idx + 1}
                    </span>

                    {/* Avatar */}
                    <Avatar className={`h-8 w-8 flex-shrink-0 border-2 ${
                      idx < 3 ? "border-emerald-200" : "border-slate-200"
                    }`}>
                      <AvatarFallback className="bg-white text-slate-700 text-[10px] font-semibold">
                        {getInitials(emp.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">{emp.name}</p>
                        <span className={`text-sm font-bold flex-shrink-0 ml-2 tabular-nums ${
                          emp.totalAvailable > 15 ? "text-emerald-600" :
                          emp.totalAvailable > 5 ? "text-sky-600" :
                          emp.totalAvailable > 0 ? "text-amber-600" :
                          "text-red-600"
                        }`}>
                          {emp.totalAvailable}d
                        </span>
                      </div>
                      {/* Horizontal fill bar relative to top employee */}
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            emp.totalAvailable > 15 ? "bg-emerald-400" :
                            emp.totalAvailable > 5 ? "bg-sky-400" :
                            emp.totalAvailable > 0 ? "bg-amber-400" :
                            "bg-red-400"
                          }`}
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">
                          {emp.availableLegal}d legales
                        </span>
                        <span className="text-[10px] text-slate-300">|</span>
                        <span className="text-[10px] text-slate-400">
                          {emp.availableNaitus}d Naitus
                        </span>
                        {emp.debtDays < 0 && (
                          <>
                            <span className="text-[10px] text-slate-300">|</span>
                            <span className="text-[10px] text-red-500 font-medium">
                              {Math.abs(emp.debtDays)}d deuda
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Usage statistics */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Uso de vacaciones</CardTitle>
              <CardDescription className="text-xs">Porcentaje de consumo del equipo</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-4 space-y-5">
            {/* Global usage */}
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-700">Uso global</span>
                <span className="text-sm font-bold text-sky-700">{stats.usagePercentage}%</span>
              </div>
              <Progress value={stats.usagePercentage} className="h-2 [&>div]:bg-sky-500" />
              <p className="text-[10px] text-slate-400 mt-1.5">
                {Math.round(stats.totalUsedAll)} dias usados de {Math.round(stats.totalCapacityAll)} totales
              </p>
            </div>

            {/* Per-employee usage -- sorted by highest usage */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Consumo por colaborador</p>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {[...stats.balanceData]
                  .sort((a, b) => {
                    const aUsage = a.totalCapacity > 0 ? a.usedDays / a.totalCapacity : 0
                    const bUsage = b.totalCapacity > 0 ? b.usedDays / b.totalCapacity : 0
                    return bUsage - aUsage
                  })
                  .map((emp) => {
                    const usagePercent = emp.totalCapacity > 0 ? Math.min(100, Math.round((emp.usedDays / emp.totalCapacity) * 100)) : 0
                    return (
                      <div key={emp.id} className="flex items-center gap-2.5">
                        <Avatar className="h-6 w-6 border border-slate-200 flex-shrink-0">
                          <AvatarFallback className="bg-slate-100 text-slate-700 text-[9px] font-semibold">
                            {getInitials(emp.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[11px] font-medium text-slate-700 truncate">{emp.shortName}</p>
                            <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{emp.usedDays}d / {emp.totalCapacity}d</span>
                          </div>
                          <Progress
                            value={usagePercent}
                            className={`h-1.5 ${
                              usagePercent > 80 ? "[&>div]:bg-red-400" :
                              usagePercent > 50 ? "[&>div]:bg-amber-400" :
                              "[&>div]:bg-emerald-400"
                            }`}
                          />
                        </div>
                        <span className={`text-[10px] font-bold flex-shrink-0 w-8 text-right ${
                          usagePercent > 80 ? "text-red-600" :
                          usagePercent > 50 ? "text-amber-600" :
                          "text-emerald-600"
                        }`}>
                          {usagePercent}%
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Quick navigation */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] gap-1.5 bg-transparent text-slate-600 hover:bg-slate-50"
                onClick={() => onNavigateTab?.("employees")}
              >
                <Users className="h-3.5 w-3.5" />
                Colaboradores
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] gap-1.5 bg-transparent text-slate-600 hover:bg-slate-50"
                onClick={() => onNavigateTab?.("calendar")}
              >
                <Calendar className="h-3.5 w-3.5" />
                Calendario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
