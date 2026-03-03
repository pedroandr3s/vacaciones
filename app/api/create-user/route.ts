import { NextResponse } from "next/server"
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"
import { adminAuth } from "@/lib/firebase-admin"

const firebaseConfig = {
  apiKey: "AIzaSyDuDH0viUla3SYze5yt5IPasdCGXJrR8Qg",
  authDomain: "vacaciones-cb783.firebaseapp.com",
  projectId: "vacaciones-cb783",
  storageBucket: "vacaciones-cb783.firebasestorage.app",
  messagingSenderId: "1000740470102",
  appId: "1:1000740470102:web:30e91b231f649b229f6af7",
}

/**
 * POST /api/create-user
 * Creates a Firebase Auth user using a secondary Firebase app instance (server-side).
 * This avoids signing out the admin in the browser.
 *
 * Accepts forceRecreate: true to delete the existing Firebase Auth account
 * (e.g. when creating a brand-new user with the same email as a former inactive employee).
 */
export async function POST(request: Request) {
  try {
    const { email, password, forceRecreate } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: email, password" },
        { status: 400 }
      )
    }

    // If forceRecreate, delete the existing Firebase Auth user first so the
    // email is freed and a new UID can be assigned to the new employee record.
    if (forceRecreate) {
      try {
        const existingUser = await adminAuth.getUserByEmail(email)
        await adminAuth.deleteUser(existingUser.uid)
      } catch (lookupErr: unknown) {
        const err = lookupErr as { code?: string }
        // auth/user-not-found is fine — nothing to delete
        if (err.code !== "auth/user-not-found") {
          console.warn("[create-user] No se pudo eliminar cuenta Auth existente:", lookupErr)
        }
      }
    }

    // Create a temporary secondary Firebase app to create the new user
    const tempAppName = `create-user-${Date.now()}`
    const tempApp = initializeApp(firebaseConfig, tempAppName)
    const tempAuth = getAuth(tempApp)

    try {
      const cred = await createUserWithEmailAndPassword(tempAuth, email, password)

      return NextResponse.json({
        success: true,
        uid: cred.user.uid,
        message: "Usuario creado correctamente en Firebase Auth.",
      })
    } finally {
      await deleteApp(tempApp)
    }
  } catch (error: unknown) {
    const firebaseErr = error as { code?: string; message?: string }
    console.error("[create-user] Error:", firebaseErr.message)

    if (firebaseErr.code === "auth/email-already-in-use") {
      return NextResponse.json({
        success: false,
        error: "Este correo ya tiene una cuenta en Firebase Auth.",
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: firebaseErr.message || "Error al crear el usuario.",
    }, { status: 500 })
  }
}
