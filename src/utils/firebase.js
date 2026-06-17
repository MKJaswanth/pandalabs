import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseEnabled = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
)

// Fallback workspace ID for dev/testing without auth
export const defaultWorkspaceId = import.meta.env.VITE_QA_WORKSPACE_ID || 'default-workspace'

const app = isFirebaseEnabled
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null

// Force long-polling instead of the default streaming WebChannel transport.
// On real domains the streaming connection is frequently aborted
// (NS_BINDING_ABORTED) by browser tracking protection, ad blockers, proxies,
// or restrictive networks — which silently breaks realtime sync and writes,
// even though auth succeeds. localhost is exempt from those protections, which
// is why dev worked while the deployed site didn't. Long-polling is reliable
// everywhere at a negligible latency cost.
export const db = app
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : null
export const auth = app ? getAuth(app) : null
