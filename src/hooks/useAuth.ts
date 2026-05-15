import { useState, useEffect, createContext, useContext } from 'react'
import type { User } from '../types/electron'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (credentials: { username: string; password: string }) => Promise<
    | { requiresMfa: true; tempToken: string }
    | { requiresMfa: false; user: User }
  >
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

import { createContext as reactCreateContext } from 'react'

export const AuthContext = reactCreateContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => { throw new Error('Not initialized') },
  logout: async () => {},
  refreshUser: async () => {}
})

export function useAuth() {
  return useContext(AuthContext)
}

export function useAuthState(): AuthContextType {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      if (window.api) {
        const session = await window.api.auth.getSession()
        setUser(session)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const login = async (credentials: { username: string; password: string }) => {
    const result = await window.api.auth.login(credentials)
    if (!result.requiresMfa) {
      setUser(result.user)
    }
    return result
  }

  const logout = async () => {
    try {
      await window.api.auth.logout()
    } finally {
      setUser(null)
    }
  }

  return { user, loading, login, logout, refreshUser }
}
