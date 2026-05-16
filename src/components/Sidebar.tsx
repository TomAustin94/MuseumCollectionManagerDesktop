import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Package,
  Tag,
  MapPin,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight,
  HardDrive
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
  const [showBackupDialog, setShowBackupDialog] = useState(false)
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null)
  const [backupInProgress, setBackupInProgress] = useState(false)
  const [networkMode, setNetworkMode] = useState<string>('standalone')

  useEffect(() => {
    window.api.auth.getSession().then(setUser).catch(() => null)
    window.api.settings.getNetwork().then((n) => setNetworkMode(n.networkMode)).catch(() => null)
  }, [])

  const handleLogoutClick = async () => {
    // Only prompt backup in non-client modes
    if (networkMode !== 'client') {
      try {
        const info = await window.api.settings.getBackupInfo()
        setLastBackupTime(info.lastBackupTime)
      } catch {
        setLastBackupTime(null)
      }
      setShowBackupDialog(true)
      return
    }
    await doLogout()
  }

  const doLogout = async () => {
    try {
      await window.api.auth.logout()
      navigate('/login')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const handleBackupAndLogout = async () => {
    setBackupInProgress(true)
    try {
      await window.api.backup.run()
      toast.success('Backup complete')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setBackupInProgress(false)
      setShowBackupDialog(false)
      await doLogout()
    }
  }

  const handleLogoutWithoutBackup = async () => {
    setShowBackupDialog(false)
    await doLogout()
  }

  return (
    <>
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

          {/* Admin-only links */}
          {user?.role === 'admin' && (
            <>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-amber-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                    collapsed && 'justify-center'
                  )
                }
                title={collapsed ? 'Settings' : undefined}
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
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
                <Shield className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Admin</span>}
              </NavLink>
            </>
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
            onClick={handleLogoutClick}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors',
              collapsed && 'justify-center'
            )}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>

      {/* Backup before sign-out dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-amber-600" />
              <DialogTitle>Back up before signing out?</DialogTitle>
            </div>
            <DialogDescription>
              Last backup:{' '}
              {lastBackupTime
                ? new Date(lastBackupTime).toLocaleString()
                : 'Never'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setShowBackupDialog(false)}
              disabled={backupInProgress}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleLogoutWithoutBackup}
                disabled={backupInProgress}
              >
                Sign out without backup
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleBackupAndLogout}
                disabled={backupInProgress}
              >
                {backupInProgress ? 'Backing up…' : 'Back up & sign out'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
