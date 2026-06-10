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
  return onSnapshot(collection(db, ...pathParts), (snapshot) => {
    if (subscriptionsSuppressed) return
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    onChange(sortFn ? rows.sort(sortFn) : rows)
  })
}

function upsert(pathParts, item) {
  ensureFirebase()
  return setDoc(doc(db, ...pathParts, item.id), cleanRecord(item), { merge: true })
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
export async function deleteProjectRemote(projectId) {
  await Promise.all([
    deleteCollection(testCasesPath(projectId)),
    deleteCollection(bugsPath(projectId)),
    deleteCollection(runsPath(projectId)),
  ])
  await remove(projectsPath(), projectId)
}

export async function clearWorkspaceRemote() {
  ensureFirebase()
  const projectsSnapshot = await getDocs(collection(db, ...projectsPath()))
  await Promise.all(projectsSnapshot.docs.map((projectDoc) => deleteProjectRemote(projectDoc.id)))
  await deleteCollection(membersPath())
}

export const subscribeTeamMembers   = (onChange)             => subscribe(membersPath(), onChange, (a, b) =>
  String(a.name ?? '').localeCompare(String(b.name ?? '')),
)
export const saveTeamMemberRemote   = (member)               => upsert(membersPath(), member)
export const deleteTeamMemberRemote = (memberId)             => remove(membersPath(), memberId)

export const subscribeTestCases     = (projectId, onChange)  => subscribe(testCasesPath(projectId), onChange, byCreatedAtAsc)
export const saveTestCaseRemote     = (projectId, testCase)  => upsert(testCasesPath(projectId), testCase)
export const deleteTestCaseRemote   = (projectId, testCaseId) => remove(testCasesPath(projectId), testCaseId)

export const subscribeBugs          = (projectId, onChange)  => subscribe(bugsPath(projectId), onChange)
export const saveBugRemote          = (projectId, bug)       => upsert(bugsPath(projectId), bug)
export const deleteBugRemote        = (projectId, bugId)     => remove(bugsPath(projectId), bugId)

export const subscribeTestRuns      = (projectId, onChange)  => subscribe(runsPath(projectId), onChange)
export const saveTestRunRemote      = (projectId, run)       => upsert(runsPath(projectId), run)
