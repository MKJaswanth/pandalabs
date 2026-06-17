import { useContext } from 'react'
import { WorkspaceSyncContext } from './WorkspaceSyncContextCore'

export const useWorkspaceSync = () => useContext(WorkspaceSyncContext)
