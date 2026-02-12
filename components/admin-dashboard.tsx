"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, Users, Calendar, CalendarDays, CalendarOff, LayoutDashboard } from "lucide-react"
import { EmployeeList } from "@/components/employee-list"
import { VacationRequestsManager } from "@/components/vacation-requests-manager"
import { TeamCalendar } from "@/components/team-calendar"
import { RegisterVacationDialog } from "@/components/register-vacation-dialog"
import { AdminRegisterUnpaidLeaveDialog } from "@/components/admin-register-unpaid-leave-dialog"
import { HolidayManager } from "@/components/holiday-manager"
import { AdminDashboardOverview } from "@/components/admin-dashboard-overview"
import { UpcomingVacations } from "@/components/upcoming-vacations"

export function AdminDashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [refreshKey, setRefreshKey] = useState(0)

  const handleVacationRegistered = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Sistema de Vacaciones</h1>
              <p className="text-sm text-slate-600">Panel de Administracion</p>
            </div>
            <div className="flex items-center gap-4">
              <AdminRegisterUnpaidLeaveDialog />
              <RegisterVacationDialog onVacationRegistered={handleVacationRegistered} />
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-slate-900">{user?.fullName}</p>
                <p className="text-xs text-slate-600">{user?.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Cerrar Sesion</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Colaboradores</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendario</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Solicitudes</span>
            </TabsTrigger>
            <TabsTrigger value="holidays" className="gap-2">
              <CalendarOff className="h-4 w-4" />
              <span className="hidden sm:inline">Feriados</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AdminDashboardOverview refreshKey={refreshKey} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <EmployeeList key={refreshKey} />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <TeamCalendar />
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <VacationRequestsManager />
          </TabsContent>

          <TabsContent value="holidays" className="space-y-6">
            <HolidayManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
