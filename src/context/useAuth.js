import { useContext } from 'react'
import { AuthContext } from './AuthContextCore'

export const useAuth = () => useContext(AuthContext)
