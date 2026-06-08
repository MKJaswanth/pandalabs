import { useCallback, useState } from 'react'
import { getCurrentUser, setCurrentUser } from '../utils/storage'

export function useCurrentUser() {
  const [user, setUser] = useState(() => getCurrentUser())

  const updateUser = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCurrentUser(trimmed)
    setUser(trimmed)
  }, [])

  return { user, updateUser }
}
