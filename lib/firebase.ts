import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import {
  initializeAuth,
  browserLocalPersistence,
  getAuth,
} from "firebase/auth"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const isNewApp = getApps().length === 0
const app = isNewApp ? initializeApp(firebaseConfig) : getApp()

export const db = getFirestore(app)

// On server (build/SSR) use getAuth; on client use initializeAuth with persistence
const isBrowser = typeof window !== "undefined"
export const auth =
  isNewApp && isBrowser
    ? initializeAuth(app, { persistence: browserLocalPersistence })
    : getAuth(app)

export const storage = getStorage(app)
