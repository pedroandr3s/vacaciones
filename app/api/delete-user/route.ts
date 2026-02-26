import { NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Falta el campo obligatorio: email" },
        { status: 400 }
      )
    }

    try {
      const userRecord = await adminAuth.getUserByEmail(email)
      await adminAuth.deleteUser(userRecord.uid)
    } catch (authError: unknown) {
      const err = authError as { code?: string }
      // If user not found in Auth, that's OK - we still want Firestore cleanup to proceed
      if (err.code !== "auth/user-not-found") {
        throw authError
      }
    }

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado de Firebase Auth.",
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[delete-user] Error:", err.message)
    return NextResponse.json(
      { success: false, error: err.message || "Error al eliminar el usuario." },
      { status: 500 }
    )
  }
}
