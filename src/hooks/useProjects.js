import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteProject, getProjects, saveProject, setProjects as setProjectsCache } from '../utils/storage'
import { isFirebaseEnabled } from '../utils/firebase'
import { deleteProjectRemote, saveProjectRemote, subscribeProjects } from '../utils/remoteStorage'

const PROJECTS_CHANGED = 'qa-projects-changed'

export function useProjects() {
  const [projects, setProjectsState] = useState(() => getProjects())

  const refresh = useCallback(() => setProjectsState(getProjects()), [])

  useEffect(() => {
    window.addEventListener(PROJECTS_CHANGED, refresh)
    return () => window.removeEventListener(PROJECTS_CHANGED, refresh)
  }, [refresh])

  useEffect(() => {
    if (!isFirebaseEnabled) return undefined
    return subscribeProjects((nextProjects) => {
      setProjectsCache(nextProjects)
      setProjectsState(nextProjects)
      window.dispatchEvent(new Event(PROJECTS_CHANGED))
    })
  }, [])

  const notify = useCallback(() => {
    window.dispatchEvent(new Event(PROJECTS_CHANGED))
  }, [])

  const addProject = useCallback((data) => {
    const project = { id: newId(), createdAt: new Date().toISOString(), ...data }
    saveProject(project)
    setProjectsState(getProjects())
    notify()
    if (isFirebaseEnabled) saveProjectRemote(project)
    return project
  }, [notify])

  const removeProject = useCallback((id) => {
    deleteProject(id)
    setProjectsState(getProjects())
    notify()
    if (isFirebaseEnabled) deleteProjectRemote(id)
  }, [notify])

  const updateProject = useCallback((project) => {
    saveProject(project)
    setProjectsState(getProjects())
    notify()
    if (isFirebaseEnabled) saveProjectRemote(project)
  }, [notify])

  return { projects, addProject, removeProject, updateProject, refresh }
}
