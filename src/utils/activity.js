import { newId } from './id'
import { defaultWorkspaceId, auth, isFirebaseEnabled } from './firebase'
import { getCurrentUser, saveActivity } from './storage'
import { logActivityRemote } from './remoteStorage'

function normalizeAction(action, type) {
  const act = action || type
  if (!act) return 'updated'
  
  const mapping = {
    project_created: 'created',
    project_updated: 'updated',
    project_deleted: 'deleted',
    test_case_created: 'created',
    test_case_updated: 'updated',
    test_case_deleted: 'deleted',
    test_case_status_changed: 'status_changed',
    bug_created: 'created',
    bug_updated: 'updated',
    bug_deleted: 'deleted',
    bug_status_changed: 'status_changed',
    test_run_started: 'run_started',
    test_run_completed: 'run_completed',
    test_run_resumed: 'run_started',
    backup_restored: 'restored',
    backup_exported: 'exported',
    requirement_created: 'created',
    requirement_updated: 'updated',
    requirement_deleted: 'deleted',
    test_plan_created: 'created',
    test_plan_updated: 'updated',
    test_plan_deleted: 'deleted',
    milestone_created: 'created',
    milestone_updated: 'updated',
    milestone_deleted: 'deleted',
  }
  
  return mapping[act] || act
}

/**
 * Creates and logs a new activity record.
 * Supports appending to localStorage and syncing with Firestore (if user signed in).
 *
 * @param {Object} params
 * @param {string} [params.projectId]
 * @param {string} params.entityType
 * @param {string} [params.entityId]
 * @param {string} [params.action]
 * @param {string} [params.type]
 * @param {string} [params.title]
 * @param {string} [params.message]
 * @param {string} [params.details]
 * @param {Object} [params.metadata]
 * @param {Object} [params.before]
 * @param {Object} [params.after]
 */
export async function addActivity(params) {
  try {
    const actorId = auth?.currentUser?.uid || ''
    const actorName = getCurrentUser() || 'Unknown user'
    const id = params.id || newId()

    const meta = { ...(params.metadata || {}) }
    if (params.before) meta.before = params.before
    if (params.after) meta.after = params.after

    const record = {
      id,
      workspaceId: defaultWorkspaceId,
      projectId: params.projectId || null,
      entityType: params.entityType,
      entityId: params.entityId || null,
      action: normalizeAction(params.action, params.type),
      title: params.title || params.message || 'Activity occurred',
      details: params.details || '',
      actorId: params.actorId || actorId,
      actorName: params.actorName || actorName,
      createdAt: params.createdAt || new Date().toISOString(),
      metadata: meta,
    }

    // Keep compatibility with logActivityRemote which uses userId / userName
    record.userId = record.actorId
    record.userName = record.actorName

    // 1. Save to local storage cache (immediate local mode)
    saveActivity(record)
    window.dispatchEvent(new Event('qa-activities-changed'))

    // 2. Save to Firebase if signed in
    const remoteReady = isFirebaseEnabled && auth?.currentUser && !auth.currentUser.isAnonymous
    if (remoteReady) {
      logActivityRemote(record).catch((err) => {
        console.error('[activity] Firestore log failed:', err)
      })
    }
  } catch (err) {
    console.error('[activity] Failed to log activity:', err)
  }
}
