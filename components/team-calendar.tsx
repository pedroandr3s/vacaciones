"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { getVacationEvents, parseLocalDate } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useData } from "@/contexts/data-context"

export function TeamCalendar() {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const { employees, requests, holidays } = useData()

  const vacationEvents = getVacationEvents(requests, employees)

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month, 1).getDay()
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    const now = new Date()
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const monthName = currentDate.toLocaleDateString("es-CL", { month: "long", year: "numeric" })

  // Today's date string for highlighting
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  // Create array of day cells
  const dayCells = []
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - firstDay + 1
    if (dayNumber > 0 && dayNumber <= daysInMonth) {
      const currentDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber)
        .toISOString()
        .split("T")[0]

      // Find vacations for this day
      const vacationsThisDay = vacationEvents.filter((event) => {
        const start = new Date(event.startDate)
        const end = new Date(event.endDate)
        const current = new Date(currentDateStr)
        return current >= start && current <= end
      })

      // Check if this day is a holiday
      const holidayThisDay = holidays.find((holiday) => holiday.date === currentDateStr)

      dayCells.push({
        day: dayNumber,
        date: currentDateStr,
        vacations: vacationsThisDay,
        holiday: holidayThisDay,
      })
    } else {
      dayCells.push(null)
    }
  }

  // Color palette for different employees
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ]

  const getEmployeeColor = (employeeId: string) => {
    const index = employees.findIndex((e) => e.id === employeeId)
    return colors[index % colors.length]
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Calendario de Equipo</h2>
          <p className="text-sm text-slate-600">Vista general de vacaciones del equipo</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg capitalize">{monthName}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>Haga click en las barras de color para ver detalles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}

            {/* Calendar cells */}
            {dayCells.map((cell, index) => {
              const isToday = cell?.date === todayStr
              return (
              <div
                key={index}
                className={`min-h-20 border relative ${
                  cell ? (cell.holiday ? "bg-red-50 border-red-300 border-2" : isToday ? "bg-blue-50 border-blue-400 border-2" : "bg-white border-slate-200") : "bg-slate-50 border-slate-200"
                } ${cell && cell.vacations.length > 0 && !cell.holiday && !isToday ? "bg-blue-50" : ""}`}
              >
                {cell && (
                  <>
                    <div className="p-1">
                      <div className={`text-xs font-medium mb-1 ${cell.holiday ? "text-red-700" : isToday ? "text-white bg-blue-600 rounded-full w-5 h-5 flex items-center justify-center" : "text-slate-700"}`}>
                        {cell.day}
                      </div>
                      
                      {/* Holiday indicator - displayed first */}
                      {cell.holiday && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 bg-red-600 text-white text-xs px-1.5 py-1 rounded font-medium mb-1 cursor-help">
                                <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{cell.holiday.name}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-red-600 text-white border-red-700">
                              <p className="font-semibold">{cell.holiday.name}</p>
                              <p className="text-xs opacity-90">
                                {parseLocalDate(cell.holiday.date).toLocaleDateString("es-CL", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Vacation indicators */}
                      <div className="space-y-1">
                        {cell.vacations.map((vacation) => (
                          <div
                            key={vacation.id}
                            className={`${
                              vacation.absenceType === "permiso_sin_goce"
                                ? "bg-orange-100 text-orange-800 border border-dashed border-orange-400"
                                : `${getEmployeeColor(vacation.employeeId)} text-white`
                            } text-xs px-1 py-0.5 rounded truncate`}
                            title={`${vacation.employeeName}${vacation.absenceType === "permiso_sin_goce" ? " (Sin goce)" : ""}`}
                          >
                            {vacation.employeeName.split(" ")[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )})}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-2">Leyenda:</p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-red-600 text-white">
                <CalendarIcon className="h-3 w-3 mr-1" />
                Feriado
              </Badge>
              <Badge className="bg-blue-500 text-white">Vacaciones remuneradas</Badge>
              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-dashed border-orange-400">
                Permiso sin goce
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
