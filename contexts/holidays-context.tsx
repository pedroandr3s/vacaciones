"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { mockHolidays } from "@/lib/mock-data"
import type { Holiday } from "@/lib/types"

interface HolidaysContextType {
  holidays: Holiday[]
  setHolidays: (holidays: Holiday[] | ((prev: Holiday[]) => Holiday[])) => void
  addHoliday: (holiday: Holiday) => void
  updateHoliday: (id: string, updates: Partial<Holiday>) => void
  deleteHoliday: (id: string) => void
}

const HolidaysContext = createContext<HolidaysContextType | undefined>(undefined)

export function HolidaysProvider({ children }: { children: ReactNode }) {
  const [holidays, setHolidays] = useState<Holiday[]>(mockHolidays)

  const addHoliday = (holiday: Holiday) => {
    setHolidays((prev) => {
      const updated = [...prev, holiday]
      // Sync with mockHolidays
      mockHolidays.length = 0
      mockHolidays.push(...updated)
      return updated
    })
  }

  const updateHoliday = (id: string, updates: Partial<Holiday>) => {
    setHolidays((prev) => {
      const updated = prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
      // Sync with mockHolidays
      mockHolidays.length = 0
      mockHolidays.push(...updated)
      return updated
    })
  }

  const deleteHoliday = (id: string) => {
    setHolidays((prev) => {
      const updated = prev.filter((h) => h.id !== id)
      // Sync with mockHolidays
      mockHolidays.length = 0
      mockHolidays.push(...updated)
      return updated
    })
  }

  return (
    <HolidaysContext.Provider
      value={{ holidays, setHolidays, addHoliday, updateHoliday, deleteHoliday }}
    >
      {children}
    </HolidaysContext.Provider>
  )
}

export function useHolidays() {
  const context = useContext(HolidaysContext)
  if (context === undefined) {
    throw new Error("useHolidays must be used within a HolidaysProvider")
  }
  return context
}
