import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Package,
  Tag,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { User } from '../types/electron'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/items', label: 'Items', icon: Package },
  { path: '/categories', label: 'Categories', icon: Tag },
  { path: '/locations', label: 'Locations', icon: MapPin },
  { path: '/reports', label: 'Reports', icon: BarChart3 }
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    window.api.auth.getSession().then(setUser).catch(() => null)
  }, [])

  const handleLogout = async () => {
    try {
      await window.api.auth.logout()
      navigate('/login')
    } catch {
      toast.error('Failed to logout')
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gray-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-6 w-6 text-amber-400 flex-shrink-0" />
            <span className="font-semibold text-sm truncate">Museum Manager</span>
          </div>
        )}
        {collapsed && <Building2 className="h-6 w-6 text-amber-400 mx-auto" />}
        <button
          onClick={onToggle}
          className={cn(
            'p-1 rounded hover:bg-gray-700 transition-colors flex-shrink-0',
            collapsed && 'mx-auto'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                collapsed && 'justify-center'
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Admin-only link */}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                collapsed && 'justify-center'
              )
            }
            title={collapsed ? 'Admin' : undefined}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Admin</span>}
          </NavLink>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-700 p-2">
        {user && !collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-white truncate">
              {user.fullName || user.username}
            </p>
            <p className="text-xs text-gray-400 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )
}
