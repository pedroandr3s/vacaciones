import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
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

// Lazy singletons - avoid initializing during SSR build
let _app: FirebaseApp | null = null
let _db: Firestore | null = null
let _auth: Auth | null = null
let _storage: FirebaseStorage | null = null

function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  }
  return _app
}

// Guard: skip Firebase client SDK init on server/build
function serverGuard(name: string): never {
  throw new Error(
    `Firebase client SDK (${name}) is not available on the server. ` +
      `Use firebase-admin for server-side operations.`
  )
}

export const db: Firestore = new Proxy({} as Firestore, {
  get(target, prop) {
    if (typeof window === "undefined") return undefined
    if (!_db) _db = getFirestore(getFirebaseApp())
    return (_db as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const auth: Auth = new Proxy({} as Auth, {
  get(target, prop) {
    if (typeof window === "undefined") return undefined
    if (!_auth) {
      const app = getFirebaseApp()
      const isNew = getApps().length <= 1
      _auth = isNew
        ? initializeAuth(app, { persistence: browserLocalPersistence })
        : getAuth(app)
    }
    return (_auth as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const storage: FirebaseStorage = new Proxy({} as FirebaseStorage, {
  get(target, prop) {
    if (typeof window === "undefined") return undefined
    if (!_storage) _storage = getStorage(getFirebaseApp())
    return (_storage as unknown as Record<string | symbol, unknown>)[prop]
  },
})
