import admin from "firebase-admin"
import path from "path"
import fs from "fs"

if (!admin.apps.length) {
  let initialized = false

  // Try env variable first
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      initialized = true
    } catch {
      console.warn("[firebase-admin] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY")
    }
  }

  // Fallback: look for service account JSON file in project root
  if (!initialized) {
    const root = process.cwd()
    const files = fs.readdirSync(root).filter(
      (f) => f.includes("firebase-adminsdk") && f.endsWith(".json")
    )
    if (files.length > 0) {
      const saPath = path.join(root, files[0])
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"))
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      initialized = true
    }
  }

  if (!initialized) {
    admin.initializeApp()
  }
}

export const adminAuth = admin.auth()
