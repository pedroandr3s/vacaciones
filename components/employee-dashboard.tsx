"use client"

import { ChartTooltipContent } from "@/components/ui/chart"

import { ChartTooltip } from "@/components/ui/chart"

import { useState, useMemo } from "react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, Plus, Info, Lock, TrendingUp, ChevronLeft, ChevronRight, CalendarDays, Briefcase, Clock, RefreshCw, CheckCircle2, CalendarHeart, User, FileText, Mail, Building, CalendarIcon, CreditCard, Cake, Download } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { VacationRequestDialog } from "@/components/vacation-request-dialog"
import { UnpaidLeaveDialog } from "@/components/unpaid-leave-dialog"
import { MyVacationRequests } from "@/components/my-vacation-requests"
import { getAbsenceTypeLabel, calculateContractorCycle, getEffectiveLegalDays, calculateSeniority, parseLocalDate } from "@/lib/utils"
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
  const { employees, balances, requests, holidays, contracts } = useData()
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [isUnpaidLeaveOpen, setIsUnpaidLeaveOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState("saldo")

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

  const legalDaysAccumulated = employee
    ? getEffectiveLegalDays(employee.hireDate, contractType as "chile" | "contractor_extranjero", balance?.legalDays || 0)
    : (balance?.legalDays || 15)
  const legalDaysUsed = balance?.usedDays || 0
  const legalAvailable = Math.max(0, legalDaysAccumulated - legalDaysUsed)
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

  // Donut chart data
  const usagePercent = legalDaysAccumulated > 0 ? Math.round((legalDaysUsed / legalDaysAccumulated) * 100) : 0
  const donutData = [
    { name: "Utilizados", value: legalDaysUsed, fill: "#2563eb" },
    { name: "Disponibles", value: Math.max(0, legalAvailable), fill: "#e2e8f0" },
  ]

  // Projection bar chart data – 6 months ahead
  const blueShades = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#eff6ff"]
  const projectionData = [
    { label: "Hoy", days: legalAvailable, fill: blueShades[0] },
    ...Array.from({ length: 6 }, (_, i) => {
      const m = addMonths(new Date(), i + 1)
      return {
        label: format(m, "MMM", { locale: es }),
        days: isContractor ? legalAvailable : legalAvailable + monthlyAccrual * (i + 1),
        fill: blueShades[i + 1],
      }
    }),
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

  // Upcoming holidays (next 120 days)
  const upcomingHolidays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return holidays
      .map((h) => {
        const hDate = parseLocalDate(h.date)
        const daysUntil = Math.ceil((hDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return { ...h, daysUntil }
      })
      .filter((h) => h.daysUntil >= 0 && h.daysUntil <= 120)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [holidays])

  const remainingHolidaysYear = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return holidays.filter((h) => parseLocalDate(h.date) >= today).length
  }, [holidays])

  const getHolidayName = (dateStr: string) => {
    const h = holidays.find((h) => h.date === dateStr)
    return h?.name
  }

  const getDayRequests = (day: Date) => {
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    return approvedRequests.filter((r) => {
      const start = parseLocalDate(r.startDate)
      const end = parseLocalDate(r.endDate)
      return dayStart >= start && dayStart <= end
    })
  }

  const selectedDayRequests = selectedDay ? getDayRequests(selectedDay) : []
  const selectedDayHoliday = selectedDay ? getHolidayName(format(selectedDay, "yyyy-MM-dd")) : null

  const seniority = employee ? calculateSeniority(employee.hireDate) : ""
  const myContracts = contracts.filter((c) => c.collaboratorId === user?.id).sort((a, b) => b.startDate.localeCompare(a.startDate))

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
        {/* Tabs + Action buttons */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <TabsList className="bg-white border border-slate-200">
              <TabsTrigger value="saldo" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Mi Saldo</span>
              </TabsTrigger>
              <TabsTrigger value="solicitudes" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Mis Solicitudes</span>
              </TabsTrigger>
              <TabsTrigger value="ficha" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Mi Ficha</span>
              </TabsTrigger>
            </TabsList>
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

          {/* ==================== TAB: MI SALDO ==================== */}
          <TabsContent value="saldo" className="space-y-6">
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
                    className="h-[180px] w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectionData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
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

            {/* Calendar + Holidays sidebar */}
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              {/* Interactive Calendar */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-base font-semibold text-slate-800">Calendario de Vacaciones y Permisos</CardTitle>
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
                      <Button variant="outline" size="sm" className="h-8 ml-1 text-xs" onClick={() => setCalendarMonth(startOfMonth(new Date()))}>
                        Hoy
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
                                    {parseLocalDate(req.startDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                    {" - "}
                                    {parseLocalDate(req.endDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
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

              {/* Feriados sidebar */}
              <Card className="border-slate-200 h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <CalendarHeart className="h-4 w-4 text-rose-500" />
                    Feriados
                  </CardTitle>
                  <CardDescription className="text-xs">Proximos 4 meses</CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs text-rose-700 font-medium">
                      {remainingHolidaysYear} proximos
                    </span>
                    <span className="text-[10px] text-slate-400">
                      de {holidays.length} totales
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  {upcomingHolidays.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CalendarHeart className="h-6 w-6 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400">Sin feriados proximos</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                      {upcomingHolidays.map((h, idx) => {
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
                              <p className="text-[10px] text-slate-400 capitalize">
                                {parseLocalDate(h.date).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                              </p>
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
          </TabsContent>

          {/* ==================== TAB: MIS SOLICITUDES ==================== */}
          <TabsContent value="solicitudes" className="space-y-6">
            <MyVacationRequests requests={myRequests} />
          </TabsContent>

          {/* ==================== TAB: MI FICHA ==================== */}
          <TabsContent value="ficha" className="space-y-6">
            {/* Información Personal */}
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg font-semibold text-slate-900">Informacion Personal</CardTitle>
                </div>
                <CardDescription className="text-sm">Datos registrados en el sistema. Contacta a RRHH para solicitar cambios.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-y-8 gap-x-12 sm:grid-cols-2">
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Nombre Completo</p>
                      <p className="text-sm text-slate-900 font-semibold mt-0.5">{employee?.fullName || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">RUT / ID</p>
                      <p className="text-sm text-slate-900 font-semibold mt-0.5">{employee?.rut || "No registrado"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Correo Electronico</p>
                      <p className="text-sm text-slate-900 mt-0.5 font-semibold">{employee?.email || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Cake className="h-4 w-4 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Fecha de Nacimiento</p>
                      <p className={`text-sm mt-0.5 font-semibold ${employee?.birthDate ? "text-slate-900" : "text-slate-400"}`}>
                        {employee?.birthDate
                          ? parseLocalDate(employee.birthDate).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
                          : "No registrada"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Building className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Cargo</p>
                      <p className="text-sm text-slate-900 font-semibold mt-0.5">{employee?.position || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Fecha de Ingreso</p>
                      <p className="text-sm text-slate-900 font-semibold mt-0.5">
                        {employee?.hireDate
                          ? parseLocalDate(employee.hireDate).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documentos y Contratos */}
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg font-semibold text-slate-900">Documentos y Contratos</CardTitle>
                </div>
                <CardDescription className="text-sm">Historial de contratos registrados. Contacta a RRHH para obtener copias.</CardDescription>
              </CardHeader>
              <CardContent>
                {myContracts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">Sin contratos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myContracts.map((contract) => (
                      <div
                        key={contract.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          contract.status === "activo"
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            contract.status === "activo" ? "bg-emerald-100" : "bg-slate-200"
                          }`}>
                            <Briefcase className={`h-4 w-4 ${contract.status === "activo" ? "text-emerald-600" : "text-slate-500"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{contract.position || employee?.position || "Colaborador"}</p>
                              <Badge
                                variant="outline"
                                className={contract.status === "activo"
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]"
                                  : "bg-slate-100 text-slate-600 border-slate-300 text-[10px]"
                                }
                              >
                                {contract.status === "activo" ? "Vigente" : "Finalizado"}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {parseLocalDate(contract.startDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                              {" — "}
                              {contract.endDate
                                ? parseLocalDate(contract.endDate).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })
                                : "Presente"}
                            </p>
                            {contract.statusReason && (
                              <p className="text-xs text-slate-400 mt-0.5">Motivo: {contract.statusReason}</p>
                            )}
                          </div>
                        </div>
                        {contract.files && contract.files.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-slate-500 hover:text-blue-600"
                            onClick={() => {
                              const file = contract.files![0]
                              if (file.url) window.open(file.url, "_blank")
                            }}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Descargar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>
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
        legalDaysTotal={legalDaysAccumulated}
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
