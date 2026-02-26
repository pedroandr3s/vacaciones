import admin from "firebase-admin"

if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } else {
    // Fallback: use application default credentials
    admin.initializeApp()
  }
}

export const adminAuth = admin.auth()
