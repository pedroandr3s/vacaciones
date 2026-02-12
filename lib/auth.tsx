"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import {
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore"
import { auth, db } from "./firebase"
import type { Employee } from "./types"

type AuthContextType = {
  user: Employee | null
  mustChangePassword: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        // Retry up to 2 times on transient network errors
        let lastErr: unknown
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const q = query(
              collection(db, "employees"),
              where("email", "==", firebaseUser.email)
            )
            const snapshot = await getDocs(q)

            if (!snapshot.empty) {
              const employeeData = snapshot.docs[0].data() as Employee
              setUser(employeeData)
              setMustChangePassword(employeeData.mustChangePassword === true)
            } else {
              setUser(null)
              setMustChangePassword(false)
            }
            lastErr = null
            break
          } catch (err) {
            lastErr = err
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
            }
          }
        }
        if (lastErr) {
          console.error("Error fetching employee from Firestore after retries:", lastErr)
          setUser(null)
        }
      } else {
        setUser(null)
        setMustChangePassword(false)
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch {
      return false
    }
  }

  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const firebaseUser = auth.currentUser
      if (!firebaseUser) return { success: false, error: "No hay sesión activa." }

      await updatePassword(firebaseUser, newPassword)

      // Mark password as changed in Firestore
      if (user) {
        const empRef = doc(db, "employees", user.id)
        await updateDoc(empRef, { mustChangePassword: false, updatedAt: new Date().toISOString() })
        setUser({ ...user, mustChangePassword: false })
        setMustChangePassword(false)
      }

      return { success: true }
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string }
      if (firebaseErr.code === "auth/weak-password") {
        return { success: false, error: "La contraseña debe tener al menos 6 caracteres." }
      }
      return { success: false, error: "Error al cambiar la contraseña. Intente nuevamente." }
    }
  }

  const logout = () => {
    signOut(auth)
    setUser(null)
    setMustChangePassword(false)
  }

  return (
    <AuthContext.Provider value={{ user, mustChangePassword, login, logout, changePassword, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
