import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth, isFirebaseEnabled } from '../utils/firebase'
import { clearWorkspaceCache, setCurrentUser } from '../utils/storage'
import { AuthContext } from './AuthContextCore'

const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }) {
  // undefined = still resolving, null = not signed in, object = signed in
  const [firebaseUser, setFirebaseUser] = useState(() => (isFirebaseEnabled ? undefined : null))
  // Error surfaced from getRedirectResult after returning from a Google sign-in redirect
  const [redirectError, setRedirectError] = useState(null)

  useEffect(() => {
    if (!isFirebaseEnabled) return undefined

    // Complete any pending Google redirect sign-in and surface errors to the UI.
    // Only surface proper Firebase auth codes — generic JS errors are silently ignored.
    getRedirectResult(auth).catch((err) => {
      if (err?.code?.startsWith('auth/')) setRedirectError(err.code)
    })

    return onAuthStateChanged(auth, (user) => setFirebaseUser(user))
  }, [])

  // Try popup first (immediate result, no page navigation); fall back to redirect
  // if the browser blocks the popup (mobile browsers, strict settings).
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        return signInWithRedirect(auth, googleProvider)
      }
      throw err
    }
  }

  const signInWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const signUpWithEmail = async (email, password, displayName) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName?.trim()) await updateProfile(user, { displayName: displayName.trim() })
  }

  const signInAsGuest = () => signInAnonymously(auth)

  const signOut = async () => {
    await firebaseSignOut(auth)
    // Clear the local cache + display name so the next sign-in starts from a
    // clean Firebase load and never shows the previous session's data.
    clearWorkspaceCache()
    setCurrentUser('')
  }

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      loading: firebaseUser === undefined,
      redirectError,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signInAsGuest,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
