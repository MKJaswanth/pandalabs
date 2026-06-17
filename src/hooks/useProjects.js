import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteProject, getProjects, getProjectsRaw, isDeleted, mergeById, saveProject, setProjects as setProjectsCache } from '../utils/storage'
import { deleteProjectRemote, saveProjectRemote, subscribeProjects } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'

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
    const project = { id: newId(), createdAt: new Date().toISOString(), ...data }
    saveProject(project)
    setProjectsState(getProjects())
    notify()
    const remoteSaved = remoteReady ? await saveProjectRemote(project) : false
    return { project, remoteSaved, remoteReady }
  }, [notify, remoteReady])

  const removeProject = useCallback((id) => {
    deleteProject(id)
    setProjectsState(getProjects())
    notify()
    if (remoteReady) deleteProjectRemote(id)
  }, [notify, remoteReady])

  const updateProject = useCallback((project) => {
    saveProject(project)
    setProjectsState(getProjects())
    notify()
    if (remoteReady) saveProjectRemote(project)
  }, [notify, remoteReady])

  return { projects, addProject, removeProject, updateProject, refresh }
}
