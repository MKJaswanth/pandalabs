import { useCallback, useEffect, useState, useRef } from 'react'
import { newId } from '../utils/id'
import {
  getNotifications,
  getNotificationsRaw,
  saveNotification,
  setNotifications as setNotificationsCache,
  deleteNotification,
  isDeleted,
  mergeById,
} from '../utils/storage'
import {
  subscribeNotifications,
  saveNotificationRemote,
  deleteNotificationRemote,
} from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { useUser } from '../context/UserContext'
import { useToast } from '../context/useToast'

export function useNotifications() {
  const { user } = useUser()
  const toast = useToast()
  const remoteReady = useRemoteSync()
  const [notifications, setNotifications] = useState(() => getNotifications())
  const prevNotificationsRef = useRef([])

  // Keep track of notifications for the current user
  const userNotifications = notifications.filter(
    (n) => n.recipient?.trim().toLowerCase() === user?.trim().toLowerCase()
  )

  const unreadCount = userNotifications.filter((n) => !n.read).length

  // Sync with Firestore
  useEffect(() => {
    if (!remoteReady) return undefined

    // Initialize the ref with the local cached state to prevent toast on load
    prevNotificationsRef.current = getNotifications().filter(
      (n) => n.recipient?.trim().toLowerCase() === user?.trim().toLowerCase()
    )

    return subscribeNotifications((nextNotifications) => {
      const merged = mergeById(getNotificationsRaw(), nextNotifications)
      setNotificationsCache(merged)

      const newAllNotifications = merged.filter((n) => !isDeleted(n))
      setNotifications(newAllNotifications)

      // Detect new incoming notifications for toast alerts
      const newUserNotifications = newAllNotifications.filter(
        (n) => n.recipient?.trim().toLowerCase() === user?.trim().toLowerCase()
      )

      const prevUserNotifications = prevNotificationsRef.current

      // Find any notification that is in the new list but was not in the previous list, is unread, and was not sent by the current user
      const freshNotifications = newUserNotifications.filter(
        (n) =>
          !n.read &&
          n.sender !== user &&
          !prevUserNotifications.some((prev) => prev.id === n.id)
      )

      if (freshNotifications.length > 0 && toast) {
        freshNotifications.forEach((n) => {
          toast.success(n.message)
        })
      }

      prevNotificationsRef.current = newUserNotifications
    })
  }, [remoteReady, user, toast])

  const sendNotification = useCallback(
    async ({ recipient, type, entityId, entityName, message, projectId }) => {
      if (!recipient || recipient.trim() === user?.trim()) return

      const notification = {
        id: newId(),
        createdAt: new Date().toISOString(),
        recipient,
        sender: user,
        type,
        entityId,
        entityName,
        message,
        projectId,
        read: false,
      }

      saveNotification(notification)
      setNotifications(getNotifications())

      if (remoteReady) {
        await saveNotificationRemote(notification)
      }
    },
    [user, remoteReady]
  )

  const markAsRead = useCallback(
    async (id) => {
      const all = getNotificationsRaw()
      const found = all.find((n) => n.id === id)
      if (found && !found.read) {
        const updated = { ...found, read: true }
        saveNotification(updated)
        setNotifications(getNotifications())

        if (remoteReady) {
          await saveNotificationRemote(updated)
        }
      }
    },
    [remoteReady]
  )

  const markAllAsRead = useCallback(async () => {
    const all = getNotificationsRaw()
    const updatedList = []

    all.forEach((n) => {
      if (
        n.recipient?.trim().toLowerCase() === user?.trim().toLowerCase() &&
        !n.read &&
        !isDeleted(n)
      ) {
        const updated = { ...n, read: true }
        saveNotification(updated)
        updatedList.push(updated)
      }
    })

    if (updatedList.length > 0) {
      setNotifications(getNotifications())
      if (remoteReady) {
        // Run updates sequentially
        for (const item of updatedList) {
          await saveNotificationRemote(item)
        }
      }
    }
  }, [user, remoteReady])

  const clearAll = useCallback(async () => {
    const all = getNotificationsRaw()
    const deletedIds = []

    all.forEach((n) => {
      if (
        n.recipient?.trim().toLowerCase() === user?.trim().toLowerCase() &&
        !isDeleted(n)
      ) {
        deleteNotification(n.id)
        deletedIds.push(n.id)
      }
    })

    if (deletedIds.length > 0) {
      setNotifications(getNotifications())
      if (remoteReady) {
        for (const id of deletedIds) {
          await deleteNotificationRemote(id)
        }
      }
    }
  }, [user, remoteReady])

  return {
    notifications: userNotifications,
    unreadCount,
    sendNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  }
}
