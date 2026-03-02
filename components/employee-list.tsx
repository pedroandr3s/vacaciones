"use client"

import { useState } from "react"
import { useData } from "@/contexts/data-context"
import type { EmployeeWithBalance } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Eye, UserX, ArrowUpDown, Trash2 } from "lucide-react"
import { isEmployeeOnVacation, getTotalAvailable, calculateSeniority, isNaitusExpired, isBenefitExpired, calculateContractorCycle, getEffectiveNaitusDays } from "@/lib/utils"
import { EmployeeDetailSheet } from "@/components/employee-detail-sheet"
import { AddCollaboratorDialog } from "@/components/add-collaborator-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function EmployeeList() {
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithBalance | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "activo" | "inactivo">("all")
  const [contractFilter, setContractFilter] = useState<"all" | "chile" | "contractor_extranjero">("all")
  const [sortBy, setSortBy] = useState<"disponibilidad" | "alfabetico" | "antiguedad">("alfabetico")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { employees, balances, requests, deleteEmployee } = useData()

  const handleCollaboratorAdded = () => {
    // DataProvider state is reactive, no need for refreshKey
  }

  const employeesWithBalances: EmployeeWithBalance[] = employees
    .filter((e) => e.role === "employee")
    .map((employee) => {
      const balance = balances.find((b) => b.employeeId === employee.id)
      const currentRequests = requests.filter((r) => r.employeeId === employee.id && r.status === "approved")
      return { ...employee, balance, currentRequests }
    })

  const filteredEmployees = employeesWithBalances
    .filter((employee) => {
      const matchesSearch = employee.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter
      const ct = employee.contractType || "chile"
      const matchesContract = contractFilter === "all" || ct === contractFilter
      return matchesSearch && matchesStatus && matchesContract
    })
    .sort((a, b) => {
      if (sortBy === "alfabetico") {
        return a.fullName.localeCompare(b.fullName)
      }
      if (sortBy === "antiguedad") {
        return new Date(a.hireDate).getTime() - new Date(b.hireDate).getTime()
      }
      // disponibilidad: mayor primero
      const balA = a.balance
      const balB = b.balance
      const ctA = (a.contractType || "chile") as "chile" | "contractor_extranjero"
      const ctB = (b.contractType || "chile") as "chile" | "contractor_extranjero"
      const availA = balA ? getTotalAvailable(balA.legalDays, balA.naitusDays, balA.usedDays, balA.debtDays, ctA) : 0
      const availB = balB ? getTotalAvailable(balB.legalDays, balB.naitusDays, balB.usedDays, balB.debtDays, ctB) : 0
      return availB - availA
    })

  const handleViewEmployee = (employee: EmployeeWithBalance) => {
    setSelectedEmployee(employee)
    setIsDetailOpen(true)
  }

  const handleDeleteEmployee = async (employee: EmployeeWithBalance) => {
    setDeletingId(employee.id)
    try {
      await deleteEmployee(employee.id, employee.email)
    } catch (err) {
      console.error("Error deleting employee:", err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Colaboradores</h2>
          <p className="text-sm text-slate-600">Gestión de saldos de vacaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {filteredEmployees.length} colaboradores
          </Badge>
          <AddCollaboratorDialog onCollaboratorAdded={handleCollaboratorAdded} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {/* Ordenar */}
          <Select value={sortBy} onValueChange={(value: "disponibilidad" | "alfabetico" | "antiguedad") => setSortBy(value)}>
            <SelectTrigger className="w-[170px]">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 mr-1.5 flex-shrink-0" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alfabetico">Orden alfabetico</SelectItem>
              <SelectItem value="disponibilidad">Mayor disponibilidad</SelectItem>
              <SelectItem value="antiguedad">Antiguedad</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por tipo de contrato */}
          <Select value={contractFilter} onValueChange={(value: "all" | "chile" | "contractor_extranjero") => setContractFilter(value)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo contrato</SelectItem>
              <SelectItem value="chile">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Chile
                </div>
              </SelectItem>
              <SelectItem value="contractor_extranjero">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  Contractor
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por estado */}
          <Select value={statusFilter} onValueChange={(value: "all" | "activo" | "inactivo") => setStatusFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo estado</SelectItem>
              <SelectItem value="activo">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Activos
                </div>
              </SelectItem>
              <SelectItem value="inactivo">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  Inactivos
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-semibold text-slate-900">Nombre</TableHead>
              <TableHead className="font-semibold text-slate-900">Tipo de Contrato</TableHead>
              <TableHead className="font-semibold text-slate-900">Estado</TableHead>
              <TableHead className="font-semibold text-slate-900">Antigüedad</TableHead>
              <TableHead className="font-semibold text-slate-900 text-right">Días Legales</TableHead>
              <TableHead className="font-semibold text-slate-900 text-right">Días Naitus</TableHead>
              <TableHead className="font-semibold text-slate-900 text-right">Disponibilidad Total</TableHead>
              <TableHead className="font-semibold text-slate-900 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((employee, index) => {
              const balance = employee.balance
              const contractType = employee.contractType || "chile"
              const totalAvailable = balance
                ? getTotalAvailable(
                    balance.legalDays,
                    balance.naitusDays,
                    balance.usedDays,
                    balance.debtDays,
                    contractType as "chile" | "contractor_extranjero",
                  )
                : 0
              const onVacation = isEmployeeOnVacation(employee.currentRequests || [])
              const currentAbsence = (employee.currentRequests || []).find((r) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const start = new Date(r.startDate)
                const end = new Date(r.endDate)
                start.setHours(0, 0, 0, 0)
                end.setHours(0, 0, 0, 0)
                return r.status === "approved" && today >= start && today <= end
              })
              const seniority = calculateSeniority(employee.hireDate)
              const naitusExpired = isNaitusExpired(employee.balance?.naitusDays || 0)
              const isContractorType = contractType === "contractor_extranjero"
              const cycleInfo = isContractorType ? calculateContractorCycle(employee.hireDate) : null

              // Display directo desde la DB (ya refleja orden de consumo)
              const legalDisplay = (balance?.legalDays || 0) - (balance?.usedDays || 0)
              const naitusDisplay = balance
                ? getEffectiveNaitusDays(balance, contractType as "chile" | "contractor_extranjero")
                : 0

              return (
                <TableRow
                  key={employee.id}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                  onClick={() => handleViewEmployee(employee)}
                >
                  <TableCell className="font-medium text-slate-900">
                    <div>
                      <div className="font-semibold">{employee.fullName}</div>
                      <div className="text-xs text-slate-500">{employee.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant="outline"
                        className={
                          isContractorType
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {isContractorType ? "Contractor en el extranjero" : "Contrato en Chile"}
                      </Badge>
                      {isContractorType && cycleInfo && (
                        <span className={`text-[10px] font-medium ${cycleInfo.hasCompletedFirstYear ? "text-green-600" : "text-amber-600"}`}>
                          {cycleInfo.hasCompletedFirstYear
                            ? `Ciclo ${cycleInfo.currentCycleNumber} activo`
                            : `${cycleInfo.daysUntilActivation}d para activar`}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {employee.status === "inactivo" ? (
                      <Badge variant="destructive" className="gap-1 text-destructive bg-[rgba(232,-26,9,0.2)] border-destructive">
                        <UserX className="h-3 w-3" />
                        Inactivo
                      </Badge>
                    ) : onVacation && currentAbsence?.absenceType === "permiso_sin_goce" ? (
                      <Badge className="bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-200">Permiso sin Goce</Badge>
                    ) : onVacation ? (
                      <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">De Vacaciones</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                        Activo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">{seniority}</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-semibold ${legalDisplay > 0 ? "text-blue-700" : "text-slate-400"}`}>
                      {legalDisplay.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-semibold ${naitusDisplay > 0 ? "text-green-700" : "text-slate-400"}`}>
                      {naitusDisplay.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-base font-bold ${
                        totalAvailable > 0 ? "text-green-700" : totalAvailable === 0 ? "text-slate-600" : "text-red-700"
                      }`}
                    >
                      {totalAvailable.toFixed(2)} días
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewEmployee(employee)
                        }}
                        className="h-8"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Gestionar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => e.stopPropagation()}
                            disabled={deletingId === employee.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar colaborador</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta accion eliminara permanentemente a <strong>{employee.fullName}</strong> del sistema,
                              incluyendo su cuenta de acceso, saldos de vacaciones, solicitudes y contratos.
                              Esta accion no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => handleDeleteEmployee(employee)}
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <EmployeeDetailSheet employee={selectedEmployee} open={isDetailOpen} onOpenChange={setIsDetailOpen} onVacationRegistered={handleCollaboratorAdded} />
    </div>
  )
}
