import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteProject, getProjects, getProjectsRaw, isDeleted, mergeById, saveProject, setProjects as setProjectsCache, getCurrentUser } from '../utils/storage'
import { deleteProjectRemote, saveProjectRemote, subscribeProjects } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'
import { addActivity } from '../utils/activity'

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
    
    addActivity({
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      action: 'created',
      title: `Project created: ${project.name}`,
      after: project,
    })
    
    return { project, remoteSaved, remoteReady }
  }, [notify, remoteReady])

  const removeProject = useCallback((id) => {
    const before = getProjects().find((p) => p.id === id)
    deleteProject(id)
    setProjectsState(getProjects())
    notify()
    if (remoteReady) {
      deleteProjectRemote(id)
    }
    
    addActivity({
      entityType: 'project',
      entityId: id,
      projectId: id,
      action: 'deleted',
      title: `Project deleted: ${before?.name || id}`,
      before,
    })
  }, [notify, remoteReady])

  const updateProject = useCallback((project) => {
    const before = getProjects().find((p) => p.id === project.id)
    saveProject(project)
    setProjectsState(getProjects())
    notify()
    if (remoteReady) {
      saveProjectRemote(project)
    }
    
    const changes = []
    if (before) {
      if (before.name !== project.name) {
        changes.push(`Name changed from "${before.name}" to "${project.name}"`)
      }
      if (before.description !== project.description) {
        changes.push('Description changed')
      }
    }
    
    addActivity({
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      action: 'updated',
      title: `Project updated: ${changes.join(', ') || 'Details changed'}`,
      before,
      after: project,
    })
  }, [notify, remoteReady])

  return { projects, addProject, removeProject, updateProject, refresh }
}

