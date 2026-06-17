import { isFirebaseEnabled } from '../utils/firebase'
import { useAuth } from '../context/useAuth'

// Firestore sync is active only for a real signed-in user (Google / email).
// Anonymous "guest" sessions are local-only by design, so we never attach
// Firestore listeners or fire remote writes for them — the security rules
// reject anonymous access anyway, which would otherwise spam errors.
export function useRemoteSync() {
  const firebaseUser = useAuth()?.firebaseUser
  return isFirebaseEnabled && !!firebaseUser && !firebaseUser.isAnonymous
}
