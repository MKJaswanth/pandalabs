import { useContext } from 'react'
import { ToastContext } from './ToastContextCore'

export const useToast = () => useContext(ToastContext)
