import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteProject, getProjects, getProjectsRaw, isDeleted, mergeById, saveProject, setProjects as setProjectsCache, getCurrentUser } from '../utils/storage'
import { deleteProjectRemote, saveProjectRemote, subscribeProjects, logActivityRemote } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'

const PROJECTS_CHANGED = 'qa-projects-changed'

export function useProjects() {
  const [projects, setProjectsState] = useState(() => getProjects())
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setProjectsState(getProjects()), [])

  useEffect(() => {
    window.addEventListener(PROJECTS_CHANGED, refresh)
    return () => window.removeEventListener(PROJECTS_CHANGED, refresh)
  }, [refresh])

  useEffect(() => {
    if (!remoteReady) return undefined
    return subscribeProjects((nextProjects) => {
      const merged = mergeById(getProjectsRaw(), nextProjects)
      setProjectsCache(merged)
      setProjectsState(merged.filter((project) => !isDeleted(project)))
      window.dispatchEvent(new Event(PROJECTS_CHANGED))
    })
  }, [remoteReady])

  const notify = useCallback(() => {
    window.dispatchEvent(new Event(PROJECTS_CHANGED))
  }, [])

  const addProject = useCallback(async (data) => {
    const creatorId = auth?.currentUser?.uid || ''
    const creatorName = getCurrentUser() || ''
    const project = {
      id: newId(),
      createdAt: new Date().toISOString(),
      createdBy: creatorId,
      createdByName: creatorName,
      ...data,
    }
    saveProject(project)
    setProjectsState(getProjects())
    notify()
    const remoteSaved = remoteReady ? await saveProjectRemote(project) : false
    if (remoteReady) {
      logActivityRemote({
        id: newId(),
        type: 'project_created',
        entityType: 'project',
        entityId: project.id,
        projectId: project.id,
        message: `Project "${project.name}" was created`,
        after: project,
      })
    }
    return { project, remoteSaved, remoteReady }
  }, [notify, remoteReady])

  const removeProject = useCallback((id) => {
    const before = getProjects().find((p) => p.id === id)
    deleteProject(id)
    setProjectsState(getProjects())
    notify()
    if (remoteReady) {
      deleteProjectRemote(id)
      logActivityRemote({
        id: newId(),
        type: 'project_deleted',
        entityType: 'project',
        entityId: id,
        projectId: id,
        message: `Project "${before?.name || id}" was deleted`,
        before,
      })
    }
  }, [notify, remoteReady])

  const updateProject = useCallback((project) => {
    const before = getProjects().find((p) => p.id === project.id)
    saveProject(project)
    setProjectsState(getProjects())
    notify()
    if (remoteReady) {
      saveProjectRemote(project)
      logActivityRemote({
        id: newId(),
        type: 'project_updated',
        entityType: 'project',
        entityId: project.id,
        projectId: project.id,
        message: `Project "${project.name}" was updated`,
        before,
        after: project,
      })
    }
  }, [notify, remoteReady])

  return { projects, addProject, removeProject, updateProject, refresh }
}
