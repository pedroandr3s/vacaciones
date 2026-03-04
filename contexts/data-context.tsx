"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import type {
  Employee,
  VacationBalance,
  VacationRequest,
  Holiday,
  Contract,
} from "@/lib/types"
import {
  fetchEmployees,
  fetchVacationBalances,
  fetchVacationRequests,
  fetchHolidays,
  fetchContracts,
  createEmployee as fsCreateEmployee,
  updateEmployee as fsUpdateEmployee,
  createVacationBalance as fsCreateBalance,
  updateVacationBalance as fsUpdateBalance,
  createVacationRequest as fsCreateRequest,
  updateVacationRequest as fsUpdateRequest,
  deleteVacationRequest as fsDeleteRequest,
  createHoliday as fsCreateHoliday,
  firebaseUpdateHoliday as fsUpdateHoliday,
  firebaseDeleteHoliday as fsDeleteHoliday,
  createContract as fsCreateContract,
  updateContract as fsUpdateContract,
  deleteEmployeeData as fsDeleteEmployeeData,
} from "@/lib/firebase-services"
import { useAuth } from "@/lib/auth"
import { calculateAccruedLegalDays } from "@/lib/utils"

interface DataContextType {
  // Data
  employees: Employee[]
  balances: VacationBalance[]
  requests: VacationRequest[]
  holidays: Holiday[]
  contracts: Contract[]
  isLoading: boolean
  error: string | null

  // Employee mutations
  addEmployee: (emp: Employee) => Promise<void>
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>
  deleteEmployee: (id: string, email: string) => Promise<void>

  // Balance mutations
  addBalance: (bal: VacationBalance) => Promise<void>
  updateBalance: (id: string, updates: Partial<VacationBalance>) => Promise<void>

  // Request mutations
  addRequest: (req: VacationRequest) => Promise<void>
  updateRequest: (id: string, updates: Partial<VacationRequest>) => Promise<void>
  deleteRequest: (id: string) => Promise<void>

  // Holiday mutations
  addHoliday: (h: Holiday) => Promise<void>
  updateHoliday: (id: string, updates: Partial<Holiday>) => Promise<void>
  deleteHoliday: (id: string) => Promise<void>
  setHolidays: (holidays: Holiday[] | ((prev: Holiday[]) => Holiday[])) => void

  // Contract mutations
  addContract: (c: Contract) => Promise<void>
  updateContract: (id: string, updates: Partial<Contract>) => Promise<void>

  // Refresh
  refreshData: () => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [balances, setBalances] = useState<VacationBalance[]>([])
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [emps, bals, reqs, hols, conts] = await Promise.all([
        fetchEmployees(),
        fetchVacationBalances(),
        fetchVacationRequests(),
        fetchHolidays(),
        fetchContracts(),
      ])

      // Sync legalDays para empleados Chile activos
      const syncUpdates: Promise<void>[] = []
      for (const bal of bals) {
        const emp = emps.find((e) => e.id === bal.employeeId)
        if (!emp || emp.status === "inactivo") continue
        const ct = (emp.contractType || "chile") as "chile" | "contractor_extranjero"
        if (ct === "contractor_extranjero") continue
        const computed = calculateAccruedLegalDays(emp.hireDate, "chile")
        if (Math.abs(computed - bal.legalDays) >= 0.01) {
          syncUpdates.push(
            fsUpdateBalance(bal.id, { legalDays: computed, updatedAt: new Date().toISOString() })
          )
          bal.legalDays = computed
        }
      }
      if (syncUpdates.length > 0) {
        await Promise.all(syncUpdates)
      }

      setEmployees(emps)
      setBalances(bals)
      setRequests(reqs)
      setHolidays(hols)
      setContracts(conts)
    } catch (err) {
      console.error("Error loading data from Firestore:", err)
      setError("No se pudieron cargar los datos. Verifica tu conexion.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    } else {
      setEmployees([])
      setBalances([])
      setRequests([])
      setHolidays([])
      setContracts([])
      setIsLoading(false)
    }
  }, [user, loadData])

  // ---- Employee mutations ----

  const addEmployee = useCallback(async (emp: Employee) => {
    await fsCreateEmployee(emp)
    setEmployees((prev) => [...prev, emp])
  }, [])

  const updateEmployee = useCallback(
    async (id: string, updates: Partial<Employee>) => {
      await fsUpdateEmployee(id, updates)
      setEmployees((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      )
    },
    []
  )

  const deleteEmployee = useCallback(async (id: string, email: string) => {
    // 1. Delete from Firebase Auth via API route
    try {
      const authRes = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const authResult = await authRes.json()
      if (!authResult.success) {
        console.warn("Auth deletion warning:", authResult.error)
      }
    } catch (authErr) {
      console.warn("Could not delete Auth user:", authErr)
    }

    // 2. Delete all Firestore data
    await fsDeleteEmployeeData(id)

    // 3. Update local state
    setEmployees((prev) => prev.filter((e) => e.id !== id))
    setBalances((prev) => prev.filter((b) => b.employeeId !== id))
    setRequests((prev) => prev.filter((r) => r.employeeId !== id))
    setContracts((prev) => prev.filter((c) => c.collaboratorId !== id))
  }, [])

  // ---- Balance mutations ----

  const addBalance = useCallback(async (bal: VacationBalance) => {
    await fsCreateBalance(bal)
    setBalances((prev) => [...prev, bal])
  }, [])

  const updateBalance = useCallback(
    async (id: string, updates: Partial<VacationBalance>) => {
      await fsUpdateBalance(id, updates)
      setBalances((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      )
    },
    []
  )

  // ---- Request mutations ----

  const addRequest = useCallback(async (req: VacationRequest) => {
    await fsCreateRequest(req)
    setRequests((prev) => [...prev, req])
  }, [])

  const updateRequest = useCallback(
    async (id: string, updates: Partial<VacationRequest>) => {
      await fsUpdateRequest(id, updates)
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      )
    },
    []
  )

  const deleteRequest = useCallback(async (id: string) => {
    await fsDeleteRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // ---- Holiday mutations ----

  const addHoliday = useCallback(async (h: Holiday) => {
    await fsCreateHoliday(h)
    setHolidays((prev) => [...prev, h])
  }, [])

  const updateHoliday = useCallback(
    async (id: string, updates: Partial<Holiday>) => {
      await fsUpdateHoliday(id, updates)
      setHolidays((prev) =>
        prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
      )
    },
    []
  )

  const deleteHoliday = useCallback(async (id: string) => {
    await fsDeleteHoliday(id)
    setHolidays((prev) => prev.filter((h) => h.id !== id))
  }, [])

  // ---- Contract mutations ----

  const addContract = useCallback(async (c: Contract) => {
    await fsCreateContract(c)
    setContracts((prev) => [...prev, c])
  }, [])

  const updateContract = useCallback(
    async (id: string, updates: Partial<Contract>) => {
      await fsUpdateContract(id, updates)
      setContracts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      )
    },
    []
  )

  return (
    <DataContext.Provider
      value={{
        employees,
        balances,
        requests,
        holidays,
        contracts,
        isLoading,
        error,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addBalance,
        updateBalance,
        addRequest,
        updateRequest,
        deleteRequest,
        addHoliday,
        updateHoliday,
        deleteHoliday,
        setHolidays,
        addContract,
        updateContract,
        refreshData: loadData,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData(): DataContextType {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error("useData must be used within a DataProvider")
  return ctx
}
