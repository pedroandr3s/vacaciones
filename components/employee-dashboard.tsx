"use client"

import { ChartTooltipContent } from "@/components/ui/chart"

import { ChartTooltip } from "@/components/ui/chart"

import { useState, useMemo } from "react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogOut, Plus, Info, Lock, TrendingUp, ChevronLeft, ChevronRight, CalendarDays, Briefcase, Clock, RefreshCw, CheckCircle2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { VacationRequestDialog } from "@/components/vacation-request-dialog"
import { UnpaidLeaveDialog } from "@/components/unpaid-leave-dialog"
import { MyVacationRequests } from "@/components/my-vacation-requests"
import { getAbsenceTypeLabel, calculateContractorCycle } from "@/lib/utils"
import { useData } from "@/contexts/data-context"
import { addMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWeekend, getDay, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts"
import {
  ChartContainer,
} from "@/components/ui/chart"

export function EmployeeDashboard() {
  const { user, logout } = useAuth()
  const { employees, balances, requests, holidays } = useData()
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [isUnpaidLeaveOpen, setIsUnpaidLeaveOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const handleVacationRegistered = () => {
    // DataProvider state is reactive, no need for refreshKey
  }

  const balance = balances.find((b) => b.employeeId === user?.id)
  const myRequests = requests.filter((r) => r.employeeId === user?.id)
  const employee = employees.find((e) => e.id === user?.id)
  const contractType = employee?.contractType || "chile"

  // Contractor cycle info
  const isContractor = contractType === "contractor_extranjero"
  const contractorCycle = isContractor && employee ? calculateContractorCycle(employee.hireDate) : null
  // Contractors extranjeros tienen beneficios INMEDIATOS desde día 1 (sin período de espera)
  const contractorActivated = true // Siempre activado para contractors extranjeros

  const legalDaysAccumulated = balance?.legalDays || (isContractor ? 15 : 15)
  const legalDaysUsed = balance?.usedDays || 0
  const legalAvailable = balance ? balance.legalDays - balance.usedDays : 0
  // Para contractors: Naitus SIEMPRE disponibles desde día 1 (sin condición de desbloqueo)
  // Para Chile: se desbloquean al usar 15 días legales
  const naitusAvailable = balance?.naitusDays || 0
  const debtDays = balance?.debtDays || 0
  const totalAvailable = legalAvailable + naitusAvailable + debtDays

  const MINIMUM_DAYS_TO_UNLOCK_NAITUS = 15
  // Para contractors extranjeros: Naitus disponibles desde día 1 (NO requieren desbloqueo)
  // Para Chile: requieren usar 15 días legales primero
  const naitusBlocked = isContractor
    ? false // Contractors extranjeros: sin bloqueo, disponibles desde día 1
    : legalDaysUsed < MINIMUM_DAYS_TO_UNLOCK_NAITUS

  const monthlyAccrual = isContractor ? 0 : 1.25
  const nextMonth = addMonths(new Date(), 1)
  const threeMonths = addMonths(new Date(), 3)
  const projectedNextMonth = isContractor ? legalAvailable : legalAvailable + monthlyAccrual
  const projectedThreeMonths = isContractor ? legalAvailable : legalAvailable + monthlyAccrual * 3

  // Donut chart data
  const usagePercent = legalDaysAccumulated > 0 ? Math.round((legalDaysUsed / legalDaysAccumulated) * 100) : 0
  const donutData = [
    { name: "Utilizados", value: legalDaysUsed, fill: "#2563eb" },
    { name: "Disponibles", value: Math.max(0, legalAvailable), fill: "#e2e8f0" },
  ]

  // Projection bar chart data
  const projectionData = [
    { label: "Hoy", days: legalAvailable, fill: "#2563eb" },
    { label: format(nextMonth, "MMM", { locale: es }), days: projectedNextMonth, fill: "#3b82f6" },
    { label: format(threeMonths, "MMM", { locale: es }), days: projectedThreeMonths, fill: "#60a5fa" },
  ]

  // Calendar logic
  const approvedRequests = useMemo(() => {
    return myRequests.filter((r) => r.status === "approved")
  }, [myRequests])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth)
    const monthEnd = endOfMonth(calendarMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    return days
  }, [calendarMonth])

  const firstDayOffset = useMemo(() => {
    const day = getDay(startOfMonth(calendarMonth))
    return day === 0 ? 6 : day - 1
  }, [calendarMonth])

  const holidaySet = useMemo(() => {
    return new Set(holidays.map((h) => h.date))
  }, [holidays])

  const getHolidayName = (dateStr: string) => {
    const h = holidays.find((h) => h.date === dateStr)
    return h?.name
  }

  const getDayRequests = (day: Date) => {
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    return approvedRequests.filter((r) => {
      const start = new Date(r.startDate)
      const end = new Date(r.endDate)
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      return dayStart >= start && dayStart <= end
    })
  }

  const selectedDayRequests = selectedDay ? getDayRequests(selectedDay) : []
  const selectedDayHoliday = selectedDay ? getHolidayName(format(selectedDay, "yyyy-MM-dd")) : null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Mis Vacaciones</h1>
              <p className="text-sm text-slate-500">Panel de gestion personal</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{user?.fullName}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={logout} className="bg-transparent">
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Cerrar Sesion</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Action bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Mi Saldo</h2>
            <Badge variant="outline" className={contractType === "contractor_extranjero" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
              {contractType === "contractor_extranjero" ? "Contractor" : "Chile"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none border-orange-300 text-orange-700 hover:bg-orange-50 bg-transparent text-sm" onClick={() => setIsUnpaidLeaveOpen(true)}>
              Permiso sin Goce
            </Button>
            <Button className="flex-1 sm:flex-none text-sm" onClick={() => setIsRequestDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Solicitar Vacaciones
            </Button>
          </div>
        </div>

        {/* Balance Overview - Hero Section */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Donut Chart Card */}
          <Card className="lg:row-span-2">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen de Saldo</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <ChartContainer
                  config={{
                    used: { label: "Utilizados", color: "#2563eb" },
                    available: { label: "Disponibles", color: "#e2e8f0" },
                  }}
                  className="h-48 w-48"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0]
                          if (!d) return null
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
                              <p className="font-medium text-slate-900">{d.name}</p>
                              <p className="text-slate-600">{Number(d.value).toFixed(2)} dias</p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-900">{legalAvailable.toFixed(2)}</span>
                  <span className="text-xs text-slate-500">disponibles</span>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-4 mt-4 w-full">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Utilizados</p>
                    <p className="text-sm font-semibold text-slate-800">{legalDaysUsed.toFixed(2)} dias</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Disponibles</p>
                    <p className="text-sm font-semibold text-slate-800">{legalAvailable.toFixed(2)} dias</p>
                  </div>
                </div>
              </div>

              {/* Usage percentage bar */}
              <div className="w-full mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{usagePercent}% utilizado</span>
                  <span>{legalDaysAccumulated.toFixed(2)} acumulados</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Detail Cards */}
          <div className="lg:col-span-2 grid gap-3 sm:grid-cols-3">
            {/* Legal Days */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Legales</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          {isContractor
                            ? "15 dias por ciclo anual, disponibles desde el primer dia de tu contrato. Se renuevan al cumplir cada aniversario."
                            : "Dias acumulados desde el inicio de tu contrato. No se reinician al cambiar de ano."}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-2xl font-bold text-blue-700">{legalAvailable.toFixed(2)}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{isContractor ? "Por ciclo" : "Acumulados"}</span>
                    <span className="font-medium text-slate-700">{legalDaysAccumulated.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Tomados</span>
                    <span className="font-medium text-slate-700">{legalDaysUsed.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Naitus Days */}
            <Card className={`relative overflow-hidden ${naitusBlocked ? "opacity-70" : ""}`}>
              <div className={`absolute top-0 left-0 w-1 h-full ${naitusBlocked ? "bg-slate-300" : "bg-emerald-500"}`} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    Naitus
                    {naitusBlocked && <Lock className="h-3 w-3 text-amber-500" />}
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          {isContractor
                            ? "5 dias adicionales de beneficio, disponibles desde el primer dia de tu contrato. El sistema descuenta primero los dias legales y cuando se agotan, usa los Naitus. Se renuevan en cada aniversario."
                            : "5 dias adicionales de regalo de la empresa. Se desbloquean al usar 15 dias legales. No son acumulables y vencen el 31 de diciembre."}
                        </p>
                        {naitusBlocked && (
                          <p className="text-xs mt-1 font-bold text-amber-600">
                            Te faltan {MINIMUM_DAYS_TO_UNLOCK_NAITUS - legalDaysUsed} dias legales para desbloquearlos.
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className={`text-2xl font-bold ${naitusBlocked ? "text-slate-400" : "text-emerald-700"}`}>
                  {naitusAvailable.toFixed(2)}
                </p>
                <div className="mt-2">
                  {naitusBlocked ? (
                    <p className="text-xs text-amber-600 font-medium">
                      Usa 15 dias legales para desbloquear
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {isContractor && contractorCycle
                        ? `Renov: ${contractorCycle.nextRenewalDate.toLocaleDateString("es-CL", { day: "numeric", month: "short" })}. Prioridad: legales primero`
                        : "Vencen el 31 de diciembre"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Total */}
            <Card className="relative overflow-hidden bg-slate-900 text-white">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Total Disponible</p>
                <p className="text-2xl font-bold text-white">{totalAvailable.toFixed(2)}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-slate-400">Legales + Naitus - Deuda</p>
                  {debtDays < 0 && (
                    <p className="text-xs text-red-400 font-medium">
                      Deuda: {Math.abs(debtDays).toFixed(2)} dias
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projection Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-semibold text-slate-700">Proyeccion de Saldo Legal</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {isContractor
                  ? "Saldo fijo de 15 dias por ciclo anual (no acumulable)"
                  : "Asumiendo 1.25 dias por mes sin consumo"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  days: { label: "Dias disponibles", color: "#2563eb" },
                }}
                className="h-[140px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectionData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={35} />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]
                        if (!d) return null
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
                            <p className="font-medium text-slate-900">{d.payload?.label}</p>
                            <p className="text-slate-600">{Number(d.value).toFixed(2)} dias disponibles</p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="days" radius={[6, 6, 0, 0]}>
                      {projectionData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <p className="text-[11px] text-slate-400 mt-2">
                {isContractor
                  ? contractorActivated
                    ? "Tienes 15 dias fijos por ciclo anual. Se renuevan en tu aniversario de contrato."
                    : "Los dias se activan al cumplir 1 ano de contrato."
                  : "Los dias legales se acumulan de forma perpetua."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Calendar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base font-semibold text-slate-800">Calendario de Ausencias</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center capitalize">
                  {format(calendarMonth, "MMMM yyyy", { locale: es })}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
              {/* Day names */}
              {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
                <div key={d} className="bg-slate-50 text-center py-2 text-xs font-medium text-slate-500">
                  {d}
                </div>
              ))}
              {/* Empty cells for offset */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white p-2 min-h-[52px] sm:min-h-[60px]" />
              ))}
              {/* Calendar days */}
              {calendarDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd")
                const dayReqs = getDayRequests(day)
                const isHoliday = holidaySet.has(dateStr)
                const isToday = isSameDay(day, new Date())
                const weekend = isWeekend(day)
                const hasVacation = dayReqs.some((r) => r.absenceType === "vacacion_remunerada")
                const hasUnpaid = dayReqs.some((r) => r.absenceType === "permiso_sin_goce")
                const isSelected = selectedDay && isSameDay(day, selectedDay)

                return (
                  <button
                    type="button"
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`
                      relative p-1.5 sm:p-2 min-h-[52px] sm:min-h-[60px] text-left transition-colors
                      ${weekend ? "bg-slate-50" : "bg-white"}
                      ${isSelected ? "ring-2 ring-blue-500 ring-inset z-10" : ""}
                      ${isToday ? "" : ""}
                      hover:bg-slate-50
                    `}
                  >
                    <span
                      className={`
                        text-xs sm:text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full
                        ${isToday ? "bg-blue-600 text-white" : ""}
                        ${weekend && !isToday ? "text-slate-400" : ""}
                        ${isHoliday && !isToday ? "text-red-500" : ""}
                        ${!isToday && !weekend && !isHoliday ? "text-slate-700" : ""}
                      `}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {hasVacation && (
                        <div className="h-1.5 w-full rounded-full bg-blue-500" title="Vacaciones" />
                      )}
                      {hasUnpaid && (
                        <div className="h-1.5 w-full rounded-full bg-orange-400" title="Permiso sin goce" />
                      )}
                      {isHoliday && !hasVacation && !hasUnpaid && (
                        <div className="h-1.5 w-full rounded-full bg-red-300" title="Feriado" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-full bg-blue-500" />
                <span>Vacaciones</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-full bg-orange-400" />
                <span>Permiso sin goce</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-full bg-red-300" />
                <span>Feriado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-medium">5</div>
                <span>Hoy</span>
              </div>
            </div>

            {/* Selected day detail */}
            {selectedDay && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-800 capitalize">
                    {format(selectedDay, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                  </h4>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500" onClick={() => setSelectedDay(null)}>
                    Cerrar
                  </Button>
                </div>
                {selectedDayHoliday && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 rounded text-sm">
                    <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-red-700 font-medium">{selectedDayHoliday}</span>
                  </div>
                )}
                {selectedDayRequests.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDayRequests.map((req) => (
                      <div key={req.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${req.absenceType === "permiso_sin_goce" ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"}`}>
                        <div className="flex items-center gap-2">
                          <Briefcase className={`h-4 w-4 ${req.absenceType === "permiso_sin_goce" ? "text-orange-600" : "text-blue-600"}`} />
                          <div>
                            <p className={`text-sm font-medium ${req.absenceType === "permiso_sin_goce" ? "text-orange-800" : "text-blue-800"}`}>
                              {getAbsenceTypeLabel(req.absenceType)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(req.startDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                              {" - "}
                              {new Date(req.endDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs bg-white">
                            {req.totalDays} dias
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !selectedDayHoliday && <p className="text-sm text-slate-400">Sin ausencias registradas</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract type info */}
        {isContractor && contractorCycle && (
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 space-y-4">
              {/* Contractor cycle status */}
              <div className="flex items-start gap-3">
                {contractorActivated ? (
                  <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 mt-0.5 flex-shrink-0 text-purple-600" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${contractorActivated ? "text-green-800" : "text-purple-800"}`}>
                    {contractorActivated
                      ? `Licencias activas - Ciclo ${contractorCycle.currentCycleNumber}`
                      : "Licencias pendientes de activacion"}
                  </p>
                  <p className={`text-xs mt-1 ${contractorActivated ? "text-green-600" : "text-purple-600"}`}>
                    {contractorActivated
                      ? "Tus 15 dias legales y 5 dias Naitus se renuevan en cada aniversario de tu contrato. Los dias Naitus estan siempre disponibles; el sistema descuenta primero los legales."
                      : `Tus licencias se activaran al cumplir 1 ano desde el inicio de tu contrato. Faltan ${contractorCycle.daysUntilActivation} dias.`}
                  </p>
                </div>
              </div>

              {/* Progress bar for cycle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-600">
                    {contractorActivated ? "Progreso del ciclo actual" : "Progreso hacia activacion"}
                  </span>
                  <span className="text-purple-700 font-medium">{contractorCycle.progressPercent}%</span>
                </div>
                <div className="w-full bg-purple-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${contractorActivated ? "bg-green-500" : "bg-purple-500"}`}
                    style={{ width: `${contractorCycle.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-purple-500">
                  <span>
                    {contractorCycle.currentCycleStartDate.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Renovacion: {contractorCycle.nextRenewalDate.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* Entitlements summary */}
              {contractorActivated && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white/60 rounded-lg p-2.5 text-center border border-purple-200">
                    <p className="text-lg font-bold text-purple-800">15</p>
                    <p className="text-[10px] text-purple-600">Dias legales por ciclo</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-2.5 text-center border border-purple-200">
                    <p className="text-lg font-bold text-purple-800">5</p>
                    <p className="text-[10px] text-purple-600">Dias Naitus por ciclo</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* My Requests */}
        <MyVacationRequests requests={myRequests} />
      </main>

      <VacationRequestDialog
        open={isRequestDialogOpen}
        onOpenChange={setIsRequestDialogOpen}
        legalAvailable={legalAvailable}
        naitusAvailable={naitusAvailable}
        employeeId={user?.id || ""}
        employeeName={user?.fullName || ""}
        employeeEmail={user?.email || ""}
        employeePosition={user?.position || ""}
        contractType={contractType as "chile" | "contractor_extranjero"}
        legalDaysTotal={balance?.legalDays || 0}
        legalUsed={balance?.usedDays || 0}
        naitusDaysTotal={balance?.naitusDays || 0}
        debtDays={balance?.debtDays || 0}
        onVacationRegistered={handleVacationRegistered}
      />

      <UnpaidLeaveDialog
        open={isUnpaidLeaveOpen}
        onOpenChange={setIsUnpaidLeaveOpen}
        employeeId={user?.id || ""}
        existingRequests={myRequests}
      />
    </div>
  )
}
