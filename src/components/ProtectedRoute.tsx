import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { User } from '../types/electron'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireRole?: 'admin' | 'editor' | 'viewer'
}

export default function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    async function check() {
      try {
        const firstRun = await window.api.setup.isFirstRun()
        setIsFirstRun(firstRun)
        if (!firstRun) {
          const session = await window.api.auth.getSession()
          setUser(session)
        }
      } catch {
        setUser(null)
        setIsFirstRun(false)
      }
    }
    check()
  }, [location.pathname])

  // Still loading
  if (user === undefined || isFirstRun === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  // First run - redirect to setup
  if (isFirstRun) {
    return <Navigate to="/setup" replace />
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Role check
  if (requireRole) {
    const roleHierarchy = { admin: 3, editor: 2, viewer: 1 }
    const userLevel = roleHierarchy[user.role] || 0
    const requiredLevel = roleHierarchy[requireRole] || 0

    if (userLevel < requiredLevel) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">You don't have permission to view this page.</p>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}
