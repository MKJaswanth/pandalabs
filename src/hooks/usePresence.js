import { useEffect, useState } from 'react'
import { auth, isFirebaseEnabled } from '../utils/firebase'
import { useUser } from '../context/UserContext'
import {
  updatePresenceRemote,
  deletePresenceRemote,
  subscribePresence
} from '../utils/remoteStorage'

export function usePresence(projectId, currentPageName) {
  const { user } = useUser()
  const [activeUsers, setActiveUsers] = useState([])

  useEffect(() => {
    if (!isFirebaseEnabled || !projectId || !user) return undefined

    const userId = auth?.currentUser?.uid || 'guest-' + user
    const userName = user

    // 1. Initial presence write
    updatePresenceRemote(projectId, userId, userName, currentPageName)

    // 2. Heartbeat loop (every 10 seconds)
    const heartbeatInterval = setInterval(() => {
      updatePresenceRemote(projectId, userId, userName, currentPageName)
    }, 10000)

    // 3. Cleanup on unmount or tab close
    const cleanup = () => {
      clearInterval(heartbeatInterval)
      deletePresenceRemote(projectId, userId)
    }

    window.addEventListener('beforeunload', cleanup)

    // 4. Subscribe to presence collection
    let rawPresence = []
    const unsubscribe = subscribePresence(projectId, (list) => {
      rawPresence = list
      filterAndSet(list)
    })

    const filterAndSet = (list) => {
      const now = Date.now()
      const threshold = 30000 // 30 seconds
      const filtered = list.filter((p) => {
        if (p.userId === userId) return false

        let lastActiveMs = now
        if (p.lastActive) {
          lastActiveMs = p.lastActive.toMillis ? p.lastActive.toMillis() : new Date(p.lastActive).getTime()
        }
        return now - lastActiveMs < threshold
      })
      setActiveUsers(filtered)
    }

    // 5. Local cleanup interval (every 5 seconds) to prune stale users dynamically
    const pruneInterval = setInterval(() => {
      filterAndSet(rawPresence)
    }, 5000)

    return () => {
      cleanup()
      window.removeEventListener('beforeunload', cleanup)
      unsubscribe()
      clearInterval(pruneInterval)
    }
  }, [projectId, currentPageName, user])

  return activeUsers
}
