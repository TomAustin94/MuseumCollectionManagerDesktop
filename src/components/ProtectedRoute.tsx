import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import type { User } from '../types/electron'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireRole?: 'admin' | 'editor' | 'viewer'
}

type AuthState =
  | { status: 'loading' }
  | { status: 'first-run' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User }

export default function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const firstRun = await window.api.setup.isFirstRun()
        if (cancelled) return

        if (firstRun) {
          setAuth({ status: 'first-run' })
          return
        }

        const session = await window.api.auth.getSession()
        if (cancelled) return

        if (session) {
          setAuth({ status: 'authenticated', user: session })
        } else {
          setAuth({ status: 'unauthenticated' })
        }
      } catch {
        if (!cancelled) setAuth({ status: 'unauthenticated' })
      }
    }

    check()
    return () => { cancelled = true }
  }, [location.pathname])

  if (auth.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-gray-800 gap-4">
        <div className="p-4 rounded-full bg-amber-100/10">
          <Building2 className="h-10 w-10 text-amber-400" />
        </div>
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-400 border-t-transparent" />
        <p className="text-gray-400 text-sm">Loading Museum Collection Manager…</p>
      </div>
    )
  }

  if (auth.status === 'first-run') {
    return <Navigate to="/setup" replace />
  }

  if (auth.status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireRole) {
    const hierarchy = { admin: 3, editor: 2, viewer: 1 }
    if ((hierarchy[auth.user.role as keyof typeof hierarchy] ?? 0) < (hierarchy[requireRole] ?? 0)) {
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
