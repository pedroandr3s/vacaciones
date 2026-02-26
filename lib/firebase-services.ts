import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore"
import { db } from "./firebase"
import type {
  Employee,
  VacationBalance,
  VacationRequest,
  Holiday,
  Contract,
} from "./types"

// ---- Retry helper for transient network errors ----

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 800
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
      }
    }
  }
  throw lastError
}

// ---- Collection names ----
const EMPLOYEES = "employees"
const VACATION_BALANCES = "vacationBalances"
const VACATION_REQUESTS = "vacationRequests"
const HOLIDAYS = "holidays"
const CONTRACTS = "contracts"

// ---- Employees ----

export async function fetchEmployees(): Promise<Employee[]> {
  const snapshot = await getDocs(collection(db, EMPLOYEES))
  return snapshot.docs.map((d) => d.data() as Employee)
}

export async function createEmployee(employee: Employee): Promise<void> {
  await withRetry(() => setDoc(doc(db, EMPLOYEES, employee.id), employee))
}

export async function updateEmployee(
  id: string,
  updates: Partial<Employee>
): Promise<void> {
  await withRetry(() => updateDoc(doc(db, EMPLOYEES, id), updates))
}

// ---- Vacation Balances ----

export async function fetchVacationBalances(): Promise<VacationBalance[]> {
  const snapshot = await getDocs(collection(db, VACATION_BALANCES))
  return snapshot.docs.map((d) => d.data() as VacationBalance)
}

export async function createVacationBalance(
  balance: VacationBalance
): Promise<void> {
  await withRetry(() => setDoc(doc(db, VACATION_BALANCES, balance.id), balance))
}

export async function updateVacationBalance(
  id: string,
  updates: Partial<VacationBalance>
): Promise<void> {
  await withRetry(() => updateDoc(doc(db, VACATION_BALANCES, id), updates))
}

// ---- Vacation Requests ----

export async function fetchVacationRequests(): Promise<VacationRequest[]> {
  const snapshot = await getDocs(collection(db, VACATION_REQUESTS))
  return snapshot.docs.map((d) => d.data() as VacationRequest)
}

export async function createVacationRequest(
  request: VacationRequest
): Promise<void> {
  await withRetry(() => setDoc(doc(db, VACATION_REQUESTS, request.id), request))
}

export async function updateVacationRequest(
  id: string,
  updates: Partial<VacationRequest>
): Promise<void> {
  await withRetry(() => updateDoc(doc(db, VACATION_REQUESTS, id), updates))
}

// ---- Holidays ----

export async function fetchHolidays(): Promise<Holiday[]> {
  const snapshot = await getDocs(collection(db, HOLIDAYS))
  return snapshot.docs.map((d) => d.data() as Holiday)
}

export async function createHoliday(holiday: Holiday): Promise<void> {
  await withRetry(() => setDoc(doc(db, HOLIDAYS, holiday.id), holiday))
}

export async function firebaseUpdateHoliday(
  id: string,
  updates: Partial<Holiday>
): Promise<void> {
  await withRetry(() => updateDoc(doc(db, HOLIDAYS, id), updates))
}

export async function firebaseDeleteHoliday(id: string): Promise<void> {
  await withRetry(() => deleteDoc(doc(db, HOLIDAYS, id)))
}

// ---- Contracts ----

export async function fetchContracts(): Promise<Contract[]> {
  const snapshot = await getDocs(collection(db, CONTRACTS))
  return snapshot.docs.map((d) => d.data() as Contract)
}

export async function createContract(contract: Contract): Promise<void> {
  await withRetry(() => setDoc(doc(db, CONTRACTS, contract.id), contract))
}

export async function updateContract(
  id: string,
  updates: Partial<Contract>
): Promise<void> {
  await withRetry(() => updateDoc(doc(db, CONTRACTS, id), updates))
}

// ---- Delete employee and all associated data ----

export async function deleteEmployeeData(employeeId: string): Promise<void> {
  // Delete vacation balances
  const balSnap = await getDocs(
    query(collection(db, VACATION_BALANCES), where("employeeId", "==", employeeId))
  )
  for (const d of balSnap.docs) {
    await deleteDoc(d.ref)
  }

  // Delete vacation requests
  const reqSnap = await getDocs(
    query(collection(db, VACATION_REQUESTS), where("employeeId", "==", employeeId))
  )
  for (const d of reqSnap.docs) {
    await deleteDoc(d.ref)
  }

  // Delete contracts
  const conSnap = await getDocs(
    query(collection(db, CONTRACTS), where("collaboratorId", "==", employeeId))
  )
  for (const d of conSnap.docs) {
    await deleteDoc(d.ref)
  }

  // Delete the employee document
  await deleteDoc(doc(db, EMPLOYEES, employeeId))
}

// ---- Utility: generate Firestore doc ID ----

export function generateId(collectionName: string): string {
  return doc(collection(db, collectionName)).id
}
