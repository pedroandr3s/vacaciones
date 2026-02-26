import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { VacationRequest, Employee, VacationBalance } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convierte una fecha en formato YYYY-MM-DD a un objeto Date en hora local
 * Evita problemas de timezone que causan errores de +/- 1 día
 * 
 * IMPORTANTE: Siempre usar esta función en lugar de new Date(dateString)
 * cuando se trabaja con fechas en formato YYYY-MM-DD para evitar conversiones
 * incorrectas debido a zonas horarias.
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Convierte un objeto Date a string en formato YYYY-MM-DD usando hora local
 * Evita problemas de timezone que causan errores de +/- 1 día al usar toISOString()
 */
export function dateToLocalString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Verifica si los Días Naitus están desbloqueados
 * Para Contrato en Chile: Se desbloquean al usar 15 días legales
 * Para Contractor extranjero: Siempre disponibles (sin condición de desbloqueo),
 *   pero el sistema prioriza descontar legales primero.
 */
export function isNaitusUnlocked(
  balance: VacationBalance,
  contractType?: "chile" | "contractor_extranjero"
): boolean {
  // Para contractors: Naitus siempre disponibles (sin condición)
  if (contractType === "contractor_extranjero") {
    return true
  }
  // Para Chile: requieren haber usado 15 días legales
  const MINIMUM_DAYS_TO_UNLOCK = 15
  return balance.usedDays >= MINIMUM_DAYS_TO_UNLOCK
}

/**
 * Verifica si los Días Naitus han expirado (no usados antes de fin de año)
 * IMPORTANTE: Los días Naitus NO son acumulables para NINGÚN tipo de contrato
 * Se renuevan cada año calendario (5 días fijos)
 * @param naitusDaysRemaining - Días Naitus restantes
 */
export function isNaitusExpired(naitusDaysRemaining: number): boolean {
  // Los días Naitus expiran si son 0 (ya los usó o los perdió por no usarlos)
  return naitusDaysRemaining === 0
}

/**
 * Calcula los meses restantes hasta fin de año para usar los Días Naitus
 * Aplica para TODOS los tipos de contrato (los días Naitus no son acumulables)
 */
export function getMonthsUntilNaitusExpires(): number {
  const today = new Date()
  const endOfYear = new Date(today.getFullYear(), 11, 31) // 31 de diciembre

  const diffTime = endOfYear.getTime() - today.getTime()
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))

  return Math.max(0, diffMonths)
}

/**
 * Obtiene los Días Naitus efectivos (considerando si están bloqueados o expirados)
 * Para Chile: bloqueados hasta usar 15 días legales
 * Para Contractor: siempre disponibles
 */
export function getEffectiveNaitusDays(
  balance: VacationBalance,
  contractType?: "chile" | "contractor_extranjero"
): number {
  // Verificar si están desbloqueados según tipo de contrato
  if (!isNaitusUnlocked(balance, contractType)) {
    return 0
  }

  // Si los días Naitus son 0, significa que expiraron o ya los usó
  if (isNaitusExpired(balance.naitusDays)) {
    return 0
  }

  return balance.naitusDays
}

// Funciones legacy para compatibilidad (mapean a las nuevas)
export const isBenefitUnlocked = (balance: VacationBalance, contractType?: "chile" | "contractor_extranjero") => isNaitusUnlocked(balance, contractType)
export const isBenefitExpired = (days: number, _contractType?: string) => isNaitusExpired(days)
export const getMonthsUntilBenefitExpires = getMonthsUntilNaitusExpires
export const getEffectiveBenefitDays = (balance: VacationBalance, contractType?: "chile" | "contractor_extranjero") => getEffectiveNaitusDays(balance, contractType)

export function isEmployeeOnVacation(requests: VacationRequest[]): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return requests.some((request) => {
    const start = new Date(request.startDate)
    const end = new Date(request.endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)

    return today >= start && today <= end
  })
}

export function getVacationEvents(requests: VacationRequest[], employees: Employee[]) {
  return requests
    .filter((request) => request.status === "approved")
    .map((request) => {
      const employee = employees.find((e) => e.id === request.employeeId)
      return {
        id: request.id,
        employeeId: request.employeeId,
        employeeName: employee?.fullName || "Unknown",
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: request.totalDays,
        absenceType: request.absenceType,
      }
    })
}

/**
 * Calcula los días hábiles entre dos fechas, excluyendo fines de semana y feriados
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de término
 * @param holidays - Array de fechas de feriados en formato YYYY-MM-DD (opcional)
 */
export function calculateBusinessDays(startDate: Date, endDate: Date, holidays: string[] = []): number {
  let count = 0
  const current = new Date(startDate)
  
  // Crear Set de feriados para búsqueda O(1)
  const holidaySet = new Set(holidays)

  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    const dateStr = dateToLocalString(current)
    
    // Contar solo días de semana (Lunes-Viernes) que no sean feriados
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * Obtiene los feriados que caen dentro de un rango de fechas (solo días hábiles)
 */
export function getHolidaysInRange(startDate: Date, endDate: Date, holidays: string[]): string[] {
  const result: string[] = []
  const current = new Date(startDate)
  const holidaySet = new Set(holidays)
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    const dateStr = dateToLocalString(current)
    // Solo contar feriados que caigan en días hábiles (Lunes-Viernes)
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && holidaySet.has(dateStr)) {
      result.push(dateStr)
    }
    current.setDate(current.getDate() + 1)
  }
  
  return result
}

/**
 * Resultado detallado del cálculo de días de vacaciones
 */
export interface VacationDaysCalculation {
  totalCalendarDays: number // Días totales en el rango (incluyendo fines de semana)
  weekendDays: number // Días de fin de semana
  holidaysInRange: string[] // Lista de feriados en el rango (solo en días hábiles)
  holidayCount: number // Cantidad de feriados
  businessDaysToDeduct: number // Días hábiles a descontar del saldo
}

/**
 * Calcula los días de vacaciones con detalle de feriados excluidos
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de término
 * @param holidays - Array de objetos con fecha y nombre del feriado
 */
export function calculateVacationDaysWithHolidays(
  startDate: Date,
  endDate: Date,
  holidays: Array<{ date: string; name: string }>
): VacationDaysCalculation {
  const holidayDates = holidays.map(h => h.date)
  const holidaySet = new Set(holidayDates)
  
  let totalCalendarDays = 0
  let weekendDays = 0
  let businessDaysToDeduct = 0
  const holidaysInRange: string[] = []
  
  const current = new Date(startDate)
  
  while (current <= endDate) {
    totalCalendarDays++
    const dayOfWeek = current.getDay()
    const dateStr = dateToLocalString(current)
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Es fin de semana
      weekendDays++
    } else if (holidaySet.has(dateStr)) {
      // Es día hábil pero es feriado
      holidaysInRange.push(dateStr)
    } else {
      // Es día hábil y no es feriado - se descuenta del saldo
      businessDaysToDeduct++
    }
    
    current.setDate(current.getDate() + 1)
  }
  
  return {
    totalCalendarDays,
    weekendDays,
    holidaysInRange,
    holidayCount: holidaysInRange.length,
    businessDaysToDeduct,
  }
}

/**
 * Obtiene el nombre de un feriado dado su fecha
 */
export function getHolidayName(date: string, holidays: Array<{ date: string; name: string }>): string {
  const holiday = holidays.find(h => h.date === date)
  return holiday?.name || "Feriado"
}

export interface BalanceSimulation {
  currentLegal: number
  currentNaitus: number
  currentDebt: number
  daysRequested: number
  legalConsumed: number
  naitusConsumed: number
  debtConsumed: number
  projectedLegal: number
  projectedNaitus: number
  projectedDebt: number
  willGoIntoDebt: boolean
  totalAvailableAfter: number
}

export function simulateVacationApproval(
  currentLegalDays: number,
  currentNaitusDays: number,
  currentDebtDays: number,
  usedDays: number,
  requestedDays: number,
): BalanceSimulation {
  // Calculate available balance
  const availableLegal = currentLegalDays - usedDays
  const availableNaitus = currentNaitusDays
  const currentDebt = currentDebtDays

  let remainingToConsume = requestedDays
  let legalConsumed = 0
  let naitusConsumed = 0
  let debtConsumed = 0

  // ORDEN ESTRICTO: 1° Descontar días legales disponibles
  if (remainingToConsume > 0 && availableLegal > 0) {
    legalConsumed = Math.min(remainingToConsume, availableLegal)
    remainingToConsume -= legalConsumed
  }

  // 2° Descontar Días Naitus (solo si los legales se agotaron y están desbloqueados)
  if (remainingToConsume > 0 && availableNaitus > 0) {
    naitusConsumed = Math.min(remainingToConsume, availableNaitus)
    remainingToConsume -= naitusConsumed
  }

  // 3° Generar deuda (solo si tanto legales como Naitus se agotaron)
  if (remainingToConsume > 0) {
    debtConsumed = remainingToConsume
  }

  const projectedLegal = availableLegal - legalConsumed
  const projectedNaitus = availableNaitus - naitusConsumed
  const projectedDebt = currentDebt - debtConsumed
  const willGoIntoDebt = debtConsumed > 0 || projectedDebt < 0

  return {
    currentLegal: availableLegal,
    currentNaitus: availableNaitus,
    currentDebt: currentDebt,
    daysRequested: requestedDays,
    legalConsumed,
    naitusConsumed,
    debtConsumed,
    projectedLegal,
    projectedNaitus,
    projectedDebt,
    willGoIntoDebt,
    totalAvailableAfter: projectedLegal + projectedNaitus + projectedDebt,
  }
}

/**
 * Calcula el total de días disponibles considerando la lógica de Días Naitus
 * @param legalDays - Días legales ACUMULADOS desde inicio del contrato
 * @param naitusDays - Días Naitus (5 días fijos, NO acumulables)
 * @param usedDays - Días ya utilizados (tomados)
 * @param debtDays - Días en deuda (negativo)
 * @param contractType - Tipo de contrato (afecta disponibilidad de Naitus)
 */
export function getTotalAvailable(
  legalDays: number,
  naitusDays: number,
  usedDays: number,
  debtDays: number,
  contractType?: "chile" | "contractor_extranjero",
): number {
  // Días legales disponibles = acumulados - tomados
  const availableLegal = legalDays - usedDays

  // Días Naitus efectivos segun tipo de contrato
  const balance = { legalDays, naitusDays, debtDays, usedDays } as any
  const effectiveNaitus = getEffectiveNaitusDays(balance, contractType)

  return availableLegal + effectiveNaitus + debtDays
}

/**
 * Verifica si un rango de fechas se solapa con solicitudes existentes aprobadas o pendientes
 * Esto evita que se programen ausencias solapadas para el mismo colaborador
 */
export function hasOverlappingRequests(
  startDate: Date,
  endDate: Date,
  existingRequests: VacationRequest[],
  excludeRequestId?: string,
  includePending: boolean = false
): { overlaps: boolean; conflictingRequest?: VacationRequest } {
  const activeRequests = existingRequests.filter((r) => {
    if (r.id === excludeRequestId) return false
    if (includePending) {
      return r.status === "approved" || r.status === "pending"
    }
    return r.status === "approved"
  })

  for (const request of activeRequests) {
    const reqStart = new Date(request.startDate)
    const reqEnd = new Date(request.endDate)
    reqStart.setHours(0, 0, 0, 0)
    reqEnd.setHours(0, 0, 0, 0)

    const newStart = new Date(startDate)
    const newEnd = new Date(endDate)
    newStart.setHours(0, 0, 0, 0)
    newEnd.setHours(0, 0, 0, 0)

    // Verificar solapamiento
    if (newStart <= reqEnd && newEnd >= reqStart) {
      return { overlaps: true, conflictingRequest: request }
    }
  }

  return { overlaps: false }
}

/**
 * Filtra solicitudes por tipo de ausencia para calculos de saldo
 * Solo las ausencias remuneradas afectan el saldo de vacaciones
 */
export function getBalanceAffectingRequests(requests: VacationRequest[]): VacationRequest[] {
  return requests.filter((r) => r.absenceType === "vacacion_remunerada")
}

/**
 * Obtiene etiqueta legible para el tipo de ausencia
 */
export function getAbsenceTypeLabel(absenceType: VacationRequest["absenceType"]): string {
  const labels: Record<string, string> = {
    vacacion_remunerada: "Vacaciones",
    solicitud_vacaciones: "Vacaciones",
    permiso_sin_goce: "Permiso sin goce",
  }
  return labels[absenceType] || absenceType
}

/**
 * Informacion del ciclo contractual de un contractor en el extranjero.
 * Los 15 dias legales y 5 Naitus se activan al cumplir 1 ano desde
 * la fecha de inicio del contrato. Al completar un nuevo ciclo anual,
 * los dias se RENUEVAN (no se acumulan).
 */
export interface ContractorCycleInfo {
  hasCompletedFirstYear: boolean
  currentCycleNumber: number
  currentCycleStartDate: Date
  currentCycleEndDate: Date
  daysUntilActivation: number
  nextRenewalDate: Date
  legalDaysEntitled: number
  naitusDaysEntitled: number
  progressPercent: number
  monthsInCurrentCycle: number
}

/**
 * Calcula información del ciclo para contractors extranjeros.
 * NOTA IMPORTANTE: Los contractors en el extranjero reciben beneficios de vacaciones
 * DESDE EL PRIMER DÍA de su contrato (15 días legales + 5 Naitus por ciclo anual).
 * No requieren completar un año para acceder a sus días de vacaciones.
 */
export function calculateContractorCycle(contractStartDate: string): ContractorCycleInfo {
  const start = new Date(contractStartDate)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  
  // Calcular cuantos anos completos han pasado
  let yearsCompleted = 0
  const testDate = new Date(start)
  while (true) {
    testDate.setFullYear(testDate.getFullYear() + 1)
    if (testDate <= today) {
      yearsCompleted++
    } else {
      break
    }
  }
  
  const hasCompletedFirstYear = yearsCompleted >= 1
  const currentCycleNumber = yearsCompleted
  
  // Fechas del ciclo actual
  const currentCycleStartDate = new Date(start)
  currentCycleStartDate.setFullYear(start.getFullYear() + yearsCompleted)
  
  const currentCycleEndDate = new Date(currentCycleStartDate)
  currentCycleEndDate.setFullYear(currentCycleStartDate.getFullYear() + 1)
  currentCycleEndDate.setDate(currentCycleEndDate.getDate() - 1)
  
  // Dias hasta activacion: Los contractors extranjeros YA NO requieren esperar un año
  // Sus beneficios están disponibles desde el día 1 del contrato
  const daysUntilActivation = 0
  
  // Proxima fecha de renovacion
  const nextRenewalDate = new Date(currentCycleEndDate)
  nextRenewalDate.setDate(nextRenewalDate.getDate() + 1)
  
  // Progreso del ciclo actual
  const cycleStartMs = currentCycleStartDate.getTime()
  const cycleEndMs = currentCycleEndDate.getTime()
  const todayMs = today.getTime()
  const progressPercent = Math.min(100, Math.max(0, Math.round(((todayMs - cycleStartMs) / (cycleEndMs - cycleStartMs)) * 100)))
  
  // Meses transcurridos en el ciclo actual
  const monthsInCurrentCycle = getMonthsBetweenDates(currentCycleStartDate, today)
  
  // BENEFICIO INMEDIATO: Contractors extranjeros reciben sus días completos desde el inicio
  // 15 días legales + 5 días Naitus disponibles desde el primer día de contrato
  return {
    hasCompletedFirstYear,
    currentCycleNumber,
    currentCycleStartDate,
    currentCycleEndDate,
    daysUntilActivation,
    nextRenewalDate,
    legalDaysEntitled: 15, // Disponible desde día 1 para contractors extranjeros
    naitusDaysEntitled: 5,  // Disponible desde día 1 para contractors extranjeros
    progressPercent,
    monthsInCurrentCycle,
  }
}

export function calculateSeniority(hireDate: string): string {
  const hire = new Date(hireDate)
  const today = new Date()
  const diffTime = Math.abs(today.getTime() - hire.getTime())
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25)

  const years = Math.floor(diffYears)
  const months = Math.floor((diffYears - years) * 12)

  if (years === 0) {
    return `${months} ${months === 1 ? "mes" : "meses"}`
  }

  return `${years} ${years === 1 ? "año" : "años"}${months > 0 ? ` y ${months} ${months === 1 ? "mes" : "meses"}` : ""}`
}

/**
 * Calcula los días legales acumulados desde la fecha de contratación
 * Fórmula: 15 días por año (1.25 días por mes)
 * Para contratos en Chile: Los días se acumulan perpetuamente
 * Para contractors extranjeros: 15 días fijos que se activan al cumplir 1 año
 *   de contrato. Al cumplir un nuevo ciclo anual, los días se RENUEVAN.
 * @param hireDate - Fecha de inicio del contrato
 * @param contractType - Tipo de contrato
 * @returns Días legales acumulados (redondeado a 1 decimal)
 */
export function calculateAccruedLegalDays(
  hireDate: string,
  contractType: "chile" | "contractor_extranjero" = "chile"
): number {
  const hire = new Date(hireDate)
  const today = new Date()
  
  // Para contractors extranjeros: 15 días se activan al cumplir 1 año
  if (contractType === "contractor_extranjero") {
    const cycle = calculateContractorCycle(hireDate)
    // Si no ha cumplido el primer año, tiene 0 días legales
    return cycle.legalDaysEntitled
  }
  
  // Para contratos en Chile: acumulación perpetua desde inicio del contrato
  const monthsWorked = getMonthsBetweenDates(hire, today)
  const accruedDays = monthsWorked * 1.25
  
  return Math.round(accruedDays * 10) / 10 // Redondear a 1 decimal
}

/**
 * Calcula los meses completos entre dos fechas
 */
export function getMonthsBetweenDates(startDate: Date, endDate: Date): number {
  const years = endDate.getFullYear() - startDate.getFullYear()
  const months = endDate.getMonth() - startDate.getMonth()
  const days = endDate.getDate() - startDate.getDate()
  
  let totalMonths = years * 12 + months
  
  // Si no ha completado el mes actual, restamos uno
  if (days < 0) {
    totalMonths--
  }
  
  return Math.max(0, totalMonths)
}

/**
 * Obtiene el contrato activo de un colaborador
 */
import type { Contract } from "./types"

export function getActiveContract(contracts: Contract[]): Contract | undefined {
  return contracts.find((c) => c.status === "activo")
}

/**
 * Obtiene la fecha de inicio del contrato activo
 */
export function getActiveHireDate(contracts: Contract[]): string | undefined {
  const active = getActiveContract(contracts)
  return active?.startDate
}

/**
 * Verifica si un colaborador tiene múltiples contratos (reingreso)
 */
export function hasRehireHistory(contracts: Contract[]): boolean {
  return contracts.length > 1
}

/**
 * Obtiene el historial de contratos ordenado por fecha
 */
export function getContractHistory(contracts: Contract[]): Contract[] {
  return [...contracts].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
}
