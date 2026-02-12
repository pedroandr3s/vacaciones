/**
 * Seed script: creates the initial admin user in Firebase Auth + Firestore.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Prerequisites:
 *   - npm install tsx (dev dependency) OR use ts-node
 *   - Firebase project must have Email/Password auth enabled
 *
 * This script will:
 *   1. Create a Firebase Auth user with the given email/password
 *   2. Create an employee document in Firestore with role "admin"
 */

import { initializeApp } from "firebase/app"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"
import { getFirestore, doc, setDoc } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDuDH0viUla3SYze5yt5IPasdCGXJrR8Qg",
  authDomain: "vacaciones-cb783.firebaseapp.com",
  projectId: "vacaciones-cb783",
  storageBucket: "vacaciones-cb783.firebasestorage.app",
  messagingSenderId: "1000740470102",
  appId: "1:1000740470102:web:30e91b231f649b229f6af7",
  measurementId: "G-SF8JP55130",
}

// ---- Configuration ----
const ADMIN_EMAIL = "admin@naitus.cl"
const ADMIN_PASSWORD = "Admin123!"
const ADMIN_NAME = "Administrador"

async function seed() {
  console.log("🔧 Initializing Firebase...")
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)

  console.log(`📧 Creating auth user: ${ADMIN_EMAIL}`)
  let uid: string
  try {
    const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
    uid = cred.user.uid
    console.log(`✅ Auth user created with UID: ${uid}`)
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string }
    if (firebaseErr.code === "auth/email-already-in-use") {
      console.log("⚠️  Auth user already exists, skipping creation.")
      console.log("   If you need to reset the password, do it from the Firebase Console.")
      // We still need the UID – sign in instead
      const { signInWithEmailAndPassword } = await import("firebase/auth")
      const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
      uid = cred.user.uid
      console.log(`   Signed in with existing UID: ${uid}`)
    } else {
      throw err
    }
  }

  // Create admin employee document in Firestore
  const now = new Date().toISOString()
  const adminEmployee = {
    id: "1",
    email: ADMIN_EMAIL,
    fullName: ADMIN_NAME,
    rut: "00.000.000-0",
    hireDate: "2024-01-01",
    position: "Administrador",
    role: "admin",
    contractType: "chile",
    status: "activo",
    createdAt: now,
    updatedAt: now,
  }

  console.log("📝 Writing admin employee document to Firestore...")
  await setDoc(doc(db, "employees", adminEmployee.id), adminEmployee)
  console.log("✅ Admin employee document created.")

  console.log("\n🎉 Seed complete!")
  console.log(`   Email:    ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
  console.log("   Role:     admin")
  console.log("\n   You can now log in to the app with these credentials.")

  process.exit(0)
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
