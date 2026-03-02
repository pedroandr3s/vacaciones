import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore, type Firestore } from "firebase/firestore"
import {
  initializeAuth,
  browserLocalPersistence,
  getAuth,
  type Auth,
} from "firebase/auth"
import { getStorage, type FirebaseStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Lazy singletons – nothing runs at module-evaluation time
let _db: Firestore | null = null
let _auth: Auth | null = null
let _storage: FirebaseStorage | null = null

function getFirebaseApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp())
  return _db
}

export function getAuthInstance(): Auth {
  if (!_auth) {
    const app = getFirebaseApp()
    const isNew = getApps().length <= 1
    _auth =
      isNew && typeof window !== "undefined"
        ? initializeAuth(app, { persistence: browserLocalPersistence })
        : getAuth(app)
  }
  return _auth
}

export function getStorageInstance(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getFirebaseApp())
  return _storage
}
