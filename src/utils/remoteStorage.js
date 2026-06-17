import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db, defaultWorkspaceId, isFirebaseEnabled } from './firebase'
import { setSyncStatus } from './syncStatus'

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

// Writes are fire-and-forget from the hooks; without a .catch a transient
// failure becomes an unhandled promise rejection. Log and move on — the local
// cache already holds the change and the next snapshot reconciles.
function logWriteError(err) {
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

function upsert(pathParts, item) {
  ensureFirebase()
  return setDoc(doc(db, ...pathParts, item.id), cleanRecord(item), { merge: true }).catch(logWriteError)
}

// Soft-delete: write a tombstone rather than removing the doc, so the deletion
// propagates to every device through the normal snapshot/merge path. A hard
// deleteDoc would let other devices' local copies resurrect the record.
function tombstone(pathParts, id) {
  ensureFirebase()
  return setDoc(
    doc(db, ...pathParts, id),
    { deleted: true, deletedAt: new Date().toISOString() },
    { merge: true },
  ).catch(logWriteError)
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

// Path builders — resolved at call time so each call uses the current user's UID
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

export const subscribeTestCases     = (projectId, onChange)  => subscribe(testCasesPath(projectId), onChange, byCreatedAtAsc)
export const saveTestCaseRemote     = (projectId, testCase)  => upsert(testCasesPath(projectId), testCase)
export const deleteTestCaseRemote   = (projectId, testCaseId) => tombstone(testCasesPath(projectId), testCaseId)

export const subscribeBugs          = (projectId, onChange)  => subscribe(bugsPath(projectId), onChange)
export const saveBugRemote          = (projectId, bug)       => upsert(bugsPath(projectId), bug)
export const deleteBugRemote        = (projectId, bugId)     => tombstone(bugsPath(projectId), bugId)

export const subscribeTestRuns      = (projectId, onChange)  => subscribe(runsPath(projectId), onChange)
export const saveTestRunRemote      = (projectId, run)       => upsert(runsPath(projectId), run)
