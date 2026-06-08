import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth, isFirebaseEnabled } from '../utils/firebase'

const AuthContext = createContext(null)

const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }) {
  // undefined = still resolving, null = not signed in, object = signed in
  const [firebaseUser, setFirebaseUser] = useState(undefined)

  useEffect(() => {
    if (!isFirebaseEnabled) {
      setFirebaseUser(null)
      return
    }
    return onAuthStateChanged(auth, (user) => setFirebaseUser(user))
  }, [])

  const signInWithGoogle = () => signInWithPopup(auth, googleProvider)

  const signInWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const signUpWithEmail = async (email, password, displayName) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName?.trim()) await updateProfile(user, { displayName: displayName.trim() })
  }

  const signOut = () => firebaseSignOut(auth)

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      loading: firebaseUser === undefined,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
