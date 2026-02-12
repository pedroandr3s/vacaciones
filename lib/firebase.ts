import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import {
  initializeAuth,
  browserLocalPersistence,
  getAuth,
} from "firebase/auth"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyDuDH0viUla3SYze5yt5IPasdCGXJrR8Qg",
  authDomain: "vacaciones-cb783.firebaseapp.com",
  projectId: "vacaciones-cb783",
  storageBucket: "vacaciones-cb783.firebasestorage.app",
  messagingSenderId: "1000740470102",
  appId: "1:1000740470102:web:30e91b231f649b229f6af7",
  measurementId: "G-SF8JP55130",
}

const isNewApp = getApps().length === 0
const app = isNewApp ? initializeApp(firebaseConfig) : getApp()

export const db = getFirestore(app)

// Use initializeAuth on first load to control persistence and avoid the
// aggressive token-refresh network call that getAuth() triggers immediately.
// On subsequent imports (HMR, etc.) the auth instance already exists so we
// fall back to getAuth() to avoid the "already initialized" error.
export const auth = isNewApp
  ? initializeAuth(app, { persistence: browserLocalPersistence })
  : getAuth(app)

export const storage = getStorage(app)
