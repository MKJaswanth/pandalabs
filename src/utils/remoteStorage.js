import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db, defaultWorkspaceId, isFirebaseEnabled, auth } from './firebase'
import { setSyncStatus } from './syncStatus'
import { newId } from './id'

const ACTIVITY_HISTORY_LIMIT = 1000

// Resolve workspace ID at call time. QA Lab is a shared team workspace, so
// the configured workspace ID must be stable across signed-in users.
function getWorkspaceId() {
  return defaultWorkspaceId
}

function workspacePath() {
  return ['workspaces', getWorkspaceId()]
}

function ensureFirebase() {
  if (!isFirebaseEnabled || !db) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to enable shared storage.')
  }
}

function cleanRecord(record) {
  // JSON round-trip strips all undefined at every nesting level, which
  // Firestore requires (it rejects documents with undefined values).
  return JSON.parse(JSON.stringify(record))
}

function logWriteError(err) {
  setSyncStatus('error')
  console.error('[remoteStorage] Write failed:', err)
}

function byCreatedAtDesc(a, b) {
  return String(b.createdAt ?? b.date ?? '').localeCompare(String(a.createdAt ?? a.date ?? ''))
}

function byCreatedAtAsc(a, b) {
  return String(a.createdAt ?? a.date ?? '').localeCompare(String(b.createdAt ?? b.date ?? ''))
}

// Set to true during backup restore to prevent Firestore snapshots from
// overwriting localStorage while we're writing new data. Resets on page reload.
let subscriptionsSuppressed = false
export function suppressSubscriptions() { subscriptionsSuppressed = true }
export function allowSubscriptions()    { subscriptionsSuppressed = false }

function subscribe(pathParts, onChange, sortFn = byCreatedAtDesc) {
  ensureFirebase()
  return onSnapshot(
    collection(db, ...pathParts),
    (snapshot) => {
      setSyncStatus('synced')
      if (subscriptionsSuppressed) return
      const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      onChange(sortFn ? rows.sort(sortFn) : rows)
    },
    (error) => {
      // Without an error handler a permission/network failure silently kills
      // the listener — the app looks "connected" while nothing ever syncs.
      setSyncStatus('error')
      console.error(`[remoteStorage] Snapshot subscription failed for ${pathParts.join('/')}:`, error)
    },
  )
}

async function upsert(pathParts, item) {
  ensureFirebase()
  setSyncStatus('syncing')
  try {
    await setDoc(doc(db, ...pathParts, item.id), cleanRecord(item), { merge: true })
    setSyncStatus('synced')
    return true
  } catch (err) {
    logWriteError(err)
    return false
  }
}

// Soft-delete: write a tombstone rather than removing the doc, so the deletion
// propagates to every device through the normal snapshot/merge path. A hard
// deleteDoc would let other devices' local copies resurrect the record.
function tombstone(pathParts, id) {
  ensureFirebase()
  setSyncStatus('syncing')
  return setDoc(
      doc(db, ...pathParts, id),
      { deleted: true, deletedAt: new Date().toISOString() },
      { merge: true },
    )
    .then(() => {
      setSyncStatus('synced')
      return true
    })
    .catch((err) => {
      logWriteError(err)
      return false
    })
}

async function remove(pathParts, id) {
  ensureFirebase()
  await deleteDoc(doc(db, ...pathParts, id))
}

async function deleteCollection(pathParts) {
  ensureFirebase()
  const snapshot = await getDocs(collection(db, ...pathParts))
  if (snapshot.empty) return
  const batch = writeBatch(db)
  snapshot.docs.forEach((item) => batch.delete(item.ref))
  await batch.commit()
}

// Path builders — resolved at call time against the fixed shared workspace ID.
const projectsPath    = ()           => [...workspacePath(), 'projects']
const membersPath     = ()           => [...workspacePath(), 'teamMembers']
const projectPath     = (projectId)  => [...projectsPath(), projectId]
const testCasesPath   = (projectId)  => [...projectPath(projectId), 'testCases']
const bugsPath        = (projectId)  => [...projectPath(projectId), 'bugs']
const runsPath        = (projectId)  => [...projectPath(projectId), 'runs']

export const subscribeProjects      = (onChange)             => subscribe(projectsPath(), onChange)
export const saveProjectRemote      = (project)              => upsert(projectsPath(), project)

// One-shot authoritative read of the workspace's projects, used by the
// workspace sync gate to decide synced vs empty vs conflict before rendering.
export async function getProjectsOnce() {
  ensureFirebase()
  const snapshot = await getDocs(collection(db, ...projectsPath()))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}
export async function deleteProjectRemote(projectId) {
  // Child collections are hard-deleted to reclaim space; the project doc itself
  // is tombstoned so the deletion propagates to other devices (a hard delete
  // would be re-added by their local merge). Called fire-and-forget, so errors
  // are logged rather than left to reject unhandled.
  try {
    await Promise.all([
      deleteCollection(testCasesPath(projectId)),
      deleteCollection(bugsPath(projectId)),
      deleteCollection(runsPath(projectId)),
    ])
    await tombstone(projectsPath(), projectId)
  } catch (err) {
    logWriteError(err)
  }
}

// Full hard wipe — used by backup "replace" restore, which intentionally
// removes everything (including tombstones) before writing fresh data.
export async function clearWorkspaceRemote() {
  ensureFirebase()
  const projectsSnapshot = await getDocs(collection(db, ...projectsPath()))
  await Promise.all(projectsSnapshot.docs.map(async (projectDoc) => {
    const projectId = projectDoc.id
    await Promise.all([
      deleteCollection(testCasesPath(projectId)),
      deleteCollection(bugsPath(projectId)),
      deleteCollection(runsPath(projectId)),
    ])
    await remove(projectsPath(), projectId)
  }))
  await deleteCollection(membersPath())
}

export const subscribeTeamMembers   = (onChange)             => subscribe(membersPath(), onChange, (a, b) =>
  String(a.name ?? '').localeCompare(String(b.name ?? '')),
)
export const saveTeamMemberRemote   = (member)               => upsert(membersPath(), member)
export const deleteTeamMemberRemote = (memberId)             => tombstone(membersPath(), memberId)

export const subscribeWorkspaceUsers = (onChange)             => subscribe([...workspacePath(), 'members'], onChange, (a, b) =>
  String(a.name ?? '').localeCompare(String(b.name ?? '')),
)

export const subscribeTestCases     = (projectId, onChange)  => subscribe(testCasesPath(projectId), onChange, byCreatedAtAsc)
export const saveTestCaseRemote     = (projectId, testCase)  => upsert(testCasesPath(projectId), testCase)
export const deleteTestCaseRemote   = (projectId, testCaseId) => tombstone(testCasesPath(projectId), testCaseId)

export const subscribeBugs          = (projectId, onChange)  => subscribe(bugsPath(projectId), onChange)
export const saveBugRemote          = (projectId, bug)       => upsert(bugsPath(projectId), bug)
export const deleteBugRemote        = (projectId, bugId)     => tombstone(bugsPath(projectId), bugId)

export const subscribeTestRuns      = (projectId, onChange)  => subscribe(runsPath(projectId), onChange)
export const saveTestRunRemote      = (projectId, run)       => upsert(runsPath(projectId), run)

function getCurrentUserName() {
  try {
    return JSON.parse(localStorage.getItem('qa_current_user') ?? 'null') ?? ''
  } catch {
    return ''
  }
}

export async function syncUserProfileRemote(firebaseUser, customName) {
  if (!isFirebaseEnabled || !firebaseUser || firebaseUser.isAnonymous || !db) return
  ensureFirebase()

  // Check if this user is marked as deleted in teamMembers to prevent session recreation
  try {
    const { getTeamMembersRaw, isDeleted } = await import('./storage')
    const allMembers = getTeamMembersRaw()
    const matching = allMembers.find((m) => m.uid === firebaseUser.uid)
    if (matching && isDeleted(matching)) {
      console.warn('[remoteStorage] User is deleted from workspace, skipping profile sync')
      return
    }
  } catch (err) {
    console.error('[remoteStorage] Failed to check deletion status before profile sync:', err)
  }

  const memberRef = doc(db, ...workspacePath(), 'members', firebaseUser.uid)
  try {
    const docSnap = await getDoc(memberRef)
    const now = new Date().toISOString()
    
    let createdAt = now
    let existingData = {}
    if (docSnap.exists()) {
      existingData = docSnap.data()
      if (existingData.createdAt) {
        createdAt = existingData.createdAt
      }
    }
    
    const profileName = customName || existingData.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User'
    const profile = {
      uid: firebaseUser.uid,
      name: profileName,
      email: firebaseUser.email || '',
      photoURL: firebaseUser.photoURL || '',
      provider: firebaseUser.providerData?.[0]?.providerId || 'password',
      createdAt,
      lastSeenAt: now,
    }
    
    await setDoc(memberRef, cleanRecord(profile), { merge: true })
  } catch (err) {
    console.error('[remoteStorage] Failed to sync user profile:', err)
  }
}

export async function deleteWorkspaceUserRemote(uid) {
  if (!isFirebaseEnabled || !db) return
  try {
    await deleteDoc(doc(db, ...workspacePath(), 'members', uid))
  } catch (err) {
    console.error('[remoteStorage] Failed to delete workspace user profile:', err)
  }
}

export async function logActivityRemote(activity) {
  if (!isFirebaseEnabled || !db) return
  try {
    const id = activity.id || newId()
    const record = {
      id,
      ...activity,
      createdAt: activity.createdAt || new Date().toISOString(),
      userId: auth?.currentUser?.uid || '',
      userName: getCurrentUserName(),
    }
    await setDoc(doc(db, ...workspacePath(), 'activity', id), cleanRecord(record))
  } catch (err) {
    console.error('[remoteStorage] Activity logging failed:', err)
  }
}

export const subscribeActivity = (onChange) => {
  ensureFirebase()
  const q = query(
    collection(db, ...workspacePath(), 'activity'),
    orderBy('createdAt', 'desc'),
    limit(ACTIVITY_HISTORY_LIMIT)
  )
  return onSnapshot(
    q,
    (snapshot) => {
      setSyncStatus('synced')
      if (subscriptionsSuppressed) return
      const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      onChange(rows)
    },
    (error) => {
      setSyncStatus('error')
      console.error('[remoteStorage] Activity snapshot subscription failed:', error)
    }
  )
}

export const subscribeRunDrafts = (projectId, onChange) =>
  subscribe([...projectPath(projectId), 'runDrafts'], onChange, byCreatedAtDesc)

export const saveRunDraftRemote = (projectId, draft) =>
  upsert([...projectPath(projectId), 'runDrafts'], draft)

export const deleteRunDraftRemote = (projectId, draftId) =>
  tombstone([...projectPath(projectId), 'runDrafts'], draftId)

const presencePath = (projectId) => [...projectPath(projectId), 'presence']

export async function updatePresenceRemote(projectId, userId, userName, currentPage) {
  if (!isFirebaseEnabled || !db) return
  try {
    const ref = doc(db, ...presencePath(projectId), userId)
    await setDoc(ref, {
      userId,
      userName,
      currentPage,
      lastActive: serverTimestamp(),
    })
  } catch (err) {
    console.error('[remoteStorage] Presence update failed:', err)
  }
}

export async function deletePresenceRemote(projectId, userId) {
  if (!isFirebaseEnabled || !db) return
  try {
    const ref = doc(db, ...presencePath(projectId), userId)
    await deleteDoc(ref)
  } catch (err) {
    console.error('[remoteStorage] Presence deletion failed:', err)
  }
}

export function subscribePresence(projectId, onChange) {
  ensureFirebase()
  const q = collection(db, ...presencePath(projectId))
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      onChange(rows)
    },
    (error) => {
      console.error('[remoteStorage] Presence subscription failed:', error)
    }
  )
}

const notificationsPath = () => [...workspacePath(), 'notifications']

export const subscribeNotifications = (onChange) => subscribe(notificationsPath(), onChange)

export async function saveNotificationRemote(notification) {
  return upsert(notificationsPath(), notification)
}

export async function deleteNotificationRemote(id) {
  if (!isFirebaseEnabled || !db) return
  try {
    const ref = doc(db, ...notificationsPath(), id)
    await deleteDoc(ref)
  } catch (err) {
    console.error('[remoteStorage] Notification deletion failed:', err)
  }
}

const sharedStepsPath = (projectId) => [...projectPath(projectId), 'sharedSteps']

export const subscribeSharedSteps = (projectId, onChange) => subscribe(sharedStepsPath(projectId), onChange, byCreatedAtAsc)

export async function saveSharedStepRemote(projectId, group) {
  return upsert(sharedStepsPath(projectId), group)
}

export async function deleteSharedStepRemote(projectId, id) {
  if (!isFirebaseEnabled || !db) return
  try {
    const ref = doc(db, ...sharedStepsPath(projectId), id)
    await deleteDoc(ref)
  } catch (err) {
    console.error('[remoteStorage] Shared step deletion failed:', err)
  }
}

const requirementsPath = (projectId) => [...projectPath(projectId), 'requirements']

export const subscribeRequirements = (projectId, onChange) =>
  subscribe(requirementsPath(projectId), onChange, byCreatedAtAsc)
export const saveRequirementRemote = (projectId, requirement) =>
  upsert(requirementsPath(projectId), requirement)
export const deleteRequirementRemote = (projectId, id) =>
  tombstone(requirementsPath(projectId), id)

const testPlansPath = (projectId) => [...projectPath(projectId), 'testPlans']

export const subscribeTestPlans = (projectId, onChange) =>
  subscribe(testPlansPath(projectId), onChange, byCreatedAtAsc)
export const saveTestPlanRemote = (projectId, plan) =>
  upsert(testPlansPath(projectId), plan)
export const deleteTestPlanRemote = (projectId, id) =>
  tombstone(testPlansPath(projectId), id)

const milestonesPath = (projectId) => [...projectPath(projectId), 'milestones']

export const subscribeMilestones = (projectId, onChange) =>
  subscribe(milestonesPath(projectId), onChange, byCreatedAtAsc)
export const saveMilestoneRemote = (projectId, milestone) =>
  upsert(milestonesPath(projectId), milestone)
export const deleteMilestoneRemote = (projectId, id) =>
  tombstone(milestonesPath(projectId), id)

// One-shot fetch of every collection for a single project. Used by global views
// (Dashboard, Reports) so their aggregate numbers are correct without the user
// having to open each project first to warm its live subscription. Includes
// tombstoned docs so the caller can merge them into the cache correctly.
export async function fetchProjectDataOnce(projectId) {
  ensureFirebase()
  const collectOnce = async (pathParts) => {
    const snapshot = await getDocs(collection(db, ...pathParts))
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  }
  const [testCases, bugs, runs, requirements, testPlans, milestones] = await Promise.all([
    collectOnce(testCasesPath(projectId)),
    collectOnce(bugsPath(projectId)),
    collectOnce(runsPath(projectId)),
    collectOnce(requirementsPath(projectId)),
    collectOnce(testPlansPath(projectId)),
    collectOnce(milestonesPath(projectId)),
  ])
  return { testCases, bugs, runs, requirements, testPlans, milestones }
}
