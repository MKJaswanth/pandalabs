import { useContext } from 'react'
import { ConfirmContext } from './ConfirmContextCore'

export const useConfirm = () => useContext(ConfirmContext)
