import { NextResponse } from "next/server"
import { initializeApp, getApps, deleteApp } from "firebase/app"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"

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
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: email, password" },
        { status: 400 }
      )
    }

    // Create a temporary secondary Firebase app to create the user
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
      // Always clean up the temporary app
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
