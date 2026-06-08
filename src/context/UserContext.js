import { createContext, useContext } from 'react'

export const UserContext = createContext({ user: '', updateUser: () => {} })
export const useUser = () => useContext(UserContext)
