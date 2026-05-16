import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Pencil,
  Trash2,
  UserCog,
  Download,
  Upload,
  Shield,
  Key,
  RefreshCw,
  FlaskConical,
  Eraser,
  RefreshCcw
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import type { AuditLogEntry } from '../types/electron'

interface UserRecord {
  id: number
  username: string
  email: string
  full_name: string | null
  role: string
  totp_enabled: number
  failed_attempts: number
  locked_until: string | null
  created_at: string
}

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  fullName: z.string().optional(),
  password: z.string().min(12),
  role: z.enum(['admin', 'editor', 'viewer'])
})

const editUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  role: z.enum(['admin', 'editor', 'viewer'])
})

const resetPasswordSchema = z.object({
  newPassword: z.string().min(12, 'At least 12 characters'),
  confirmPassword: z.string()
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

type CreateUserForm = z.infer<typeof createUserSchema>
type EditUserForm = z.infer<typeof editUserSchema>
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

export default function AdminPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditLoading, setAuditLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ id: number; role: string } | null>(null)

  const [createDialog, setCreateDialog] = useState(false)
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: UserRecord | null }>({
    open: false,
    user: null
  })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserRecord | null }>({
    open: false,
    user: null
  })
  const [resetPwDialog, setResetPwDialog] = useState<{ open: boolean; user: UserRecord | null }>({
    open: false,
    user: null
  })
  const [saving, setSaving] = useState(false)

  const createForm = useForm<CreateUserForm>({ resolver: zodResolver(createUserSchema) })
  const editForm = useForm<EditUserForm>({ resolver: zodResolver(editUserSchema) })
  const resetPwForm = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) })

  useEffect(() => {
    window.api.auth.getSession().then((u) => {
      if (u) setCurrentUser({ id: u.id, role: u.role })
      if (u?.role !== 'admin') navigate('/')
    }).catch(() => navigate('/'))
  }, [navigate])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const u = await window.api.admin.users.list()
      setUsers(u as unknown as UserRecord[])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchAuditLog = async (page = 1) => {
    setAuditLoading(true)
    try {
      const result = await window.api.admin.auditLog.list({ page, limit: 30 })
      setAuditEntries(result.entries)
      setAuditTotal(result.total)
      setAuditPage(page)
    } catch {
      toast.error('Failed to load audit log')
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchAuditLog()
  }, [])

  const [expandedAuditRow, setExpandedAuditRow] = useState<number | null>(null)

  const getRecordName = (entry: AuditLogEntry): string => {
    try {
      const data = JSON.parse((entry.new_data ?? entry.old_data) || '{}') as Record<string, unknown>
      if (entry.table_name === 'items') {
        return String(data.title || data.accession_number || `#${entry.record_id}`)
      }
      if (entry.table_name === 'categories' || entry.table_name === 'locations') {
        return String(data.name || `#${entry.record_id}`)
      }
      if (entry.table_name === 'users') {
        return String(data.username || `#${entry.record_id}`)
      }
    } catch { /* ignore */ }
    return `#${entry.record_id}`
  }

  const SKIP_DIFF_FIELDS = new Set([
    'id', 'created_at', 'updated_at', 'changed_at', 'password_hash', 'totp_secret'
  ])

  const getDiff = (entry: AuditLogEntry): Array<{ field: string; from: string; to: string }> => {
    if (entry.action !== 'UPDATE' || !entry.old_data || !entry.new_data) return []
    try {
      const oldD = JSON.parse(entry.old_data) as Record<string, unknown>
      const newD = JSON.parse(entry.new_data) as Record<string, unknown>
      return Object.keys(newD)
        .filter((k) => !SKIP_DIFF_FIELDS.has(k) && String(oldD[k] ?? '') !== String(newD[k] ?? ''))
        .map((k) => ({
          field: k.replace(/_/g, ' '),
          from: String(oldD[k] ?? '—'),
          to: String(newD[k] ?? '—')
        }))
    } catch { return [] }
  }

  const onCreateUser = async (data: CreateUserForm) => {
    setSaving(true)
    try {
      await window.api.admin.users.create({
        username: data.username,
        email: data.email,
        password: data.password,
        fullName: data.fullName || null,
        role: data.role
      })
      toast.success('User created')
      setCreateDialog(false)
      createForm.reset()
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const onEditUser = async (data: EditUserForm) => {
    if (!editDialog.user) return
    setSaving(true)
    try {
      await window.api.admin.users.update(editDialog.user.id, {
        email: data.email,
        fullName: data.fullName || null,
        role: data.role
      })
      toast.success('User updated')
      setEditDialog({ open: false, user: null })
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const onDeleteUser = async () => {
    if (!deleteDialog.user) return
    try {
      await window.api.admin.users.delete(deleteDialog.user.id)
      toast.success('User deleted')
      setDeleteDialog({ open: false, user: null })
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const onResetPassword = async (data: ResetPasswordForm) => {
    if (!resetPwDialog.user) return
    setSaving(true)
    try {
      await window.api.admin.users.resetPassword(resetPwDialog.user.id, data.newPassword)
      toast.success('Password reset')
      setResetPwDialog({ open: false, user: null })
      resetPwForm.reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  const handleBackup = async () => {
    try {
      const result = await window.api.admin.database.backup()
      if (result.success) {
        toast.success(`Database backed up to ${result.filePath}`)
      }
    } catch (err) {
      toast.error('Backup failed')
    }
  }

  const handleRestore = async () => {
    try {
      const result = await window.api.admin.database.restore()
      if (result.success) {
        toast.success('Database restored. Please restart the application.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Restore failed')
    }
  }

  const handleDemoImport = async () => {
    try {
      const result = await window.api.admin.demo.import()
      toast.success(`Demo data imported: ${result.items} items, ${result.categories} categories, ${result.locations} locations`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    }
  }

  const handleDemoClear = async () => {
    try {
      const result = await window.api.admin.demo.clear()
      toast.success(`Removed ${result.items} demo items`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Clear failed')
    }
  }

  const openEdit = (user: UserRecord) => {
    editForm.reset({
      email: user.email,
      fullName: user.full_name || '',
      role: user.role as 'admin' | 'editor' | 'viewer'
    })
    setEditDialog({ open: true, user })
  }

  const auditTotalPages = Math.ceil(auditTotal / 30)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-sm text-gray-500">Manage users, audit log, and database</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">{users.length} user(s)</p>
            <Button onClick={() => setCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingUsers ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>2FA</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-sm">{user.username}</TableCell>
                        <TableCell>{user.full_name || '—'}</TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              user.role === 'admin'
                                ? 'bg-red-100 text-red-800'
                                : user.role === 'editor'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          {user.totp_enabled ? (
                            <Shield className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.locked_until && new Date(user.locked_until) > new Date() ? (
                            <span className="text-xs text-red-600">Locked</span>
                          ) : (
                            <span className="text-xs text-green-600">Active</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setResetPwDialog({ open: true, user })}
                              title="Reset password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteDialog({ open: true, user })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">{auditTotal} total entries</p>
            <Button variant="outline" size="sm" onClick={() => fetchAuditLog(1)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Changes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEntries.map((entry) => {
                      const diff = getDiff(entry)
                      const isExpanded = expandedAuditRow === entry.id
                      return (
                        <React.Fragment key={entry.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedAuditRow(isExpanded ? null : entry.id)}
                          >
                            <TableCell className="text-sm">{formatDateTime(entry.changed_at)}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {entry.username || 'System'}
                            </TableCell>
                            <TableCell className="text-sm capitalize">
                              {entry.table_name.replace('_', ' ')}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  entry.action === 'INSERT'
                                    ? 'bg-green-100 text-green-800'
                                    : entry.action === 'UPDATE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : entry.action === 'DELETE'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {entry.action}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {getRecordName(entry)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.action === 'UPDATE' && diff.length > 0
                                ? `${diff.length} field${diff.length !== 1 ? 's' : ''} changed`
                                : entry.action === 'INSERT'
                                ? 'New record'
                                : entry.action === 'DELETE'
                                ? 'Deleted'
                                : '—'}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-gray-50">
                              <TableCell colSpan={6} className="py-3 px-4">
                                {entry.action === 'UPDATE' && diff.length > 0 ? (
                                  <div className="space-y-1">
                                    {diff.map(({ field, from, to }) => (
                                      <div key={field} className="flex items-start gap-2 text-xs">
                                        <span className="font-medium text-gray-600 capitalize w-32 flex-shrink-0">
                                          {field}
                                        </span>
                                        <span className="text-red-600 line-through truncate max-w-[180px]">
                                          {from}
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-green-700 truncate max-w-[180px]">
                                          {to}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : entry.action === 'INSERT' ? (
                                  <p className="text-xs text-gray-500">
                                    Created: {getRecordName(entry)}
                                  </p>
                                ) : entry.action === 'DELETE' ? (
                                  <p className="text-xs text-gray-500">
                                    Deleted: {getRecordName(entry)}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-500">No details available</p>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {auditTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {auditPage} of {auditTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAuditLog(auditPage - 1)}
                  disabled={auditPage <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAuditLog(auditPage + 1)}
                  disabled={auditPage >= auditTotalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Backup Database
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Export the entire database to a file for safekeeping.
                </p>
                <Button onClick={handleBackup}>
                  <Download className="h-4 w-4 mr-2" />
                  Save Backup
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Restore Database
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Restore from a previously saved backup file. Current data will be replaced.
                </p>
                <Button variant="destructive" onClick={handleRestore}>
                  <Upload className="h-4 w-4 mr-2" />
                  Restore from Backup
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-amber-600" />
                  Demo Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Populate the collection with sample items — paintings, sculptures, ceramics,
                  archaeology, natural history and more — to explore the app before adding your
                  own data. Demo items can be removed at any time.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleDemoImport} className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" />
                    Import Demo Data
                  </Button>
                  <Button variant="ghost" onClick={handleDemoClear} className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Eraser className="h-4 w-4" />
                    Remove Demo Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4 text-blue-600" />
                  Software Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  The app checks for updates automatically on launch. You can also check manually at any time.
                  If an update is available it will download in the background and prompt you to restart.
                </p>
                <Button variant="outline" onClick={() => window.api.updater.check()} className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Check for Updates Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateUser)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Username *</Label>
                <Input {...createForm.register('username')} />
                {createForm.formState.errors.username && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.username.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input {...createForm.register('fullName')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" {...createForm.register('email')} />
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" {...createForm.register('password')} />
              {createForm.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select
                value={createForm.watch('role') || ''}
                onValueChange={(v) => createForm.setValue('role', v as 'admin' | 'editor' | 'viewer')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, user: open ? editDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {editDialog.user?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditUser)} className="space-y-4">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" {...editForm.register('email')} />
            </div>
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input {...editForm.register('fullName')} />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select
                value={editForm.watch('role') || ''}
                onValueChange={(v) => editForm.setValue('role', v as 'admin' | 'editor' | 'viewer')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog({ open: false, user: null })}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwDialog.open} onOpenChange={(open) => setResetPwDialog({ open, user: open ? resetPwDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password: {resetPwDialog.user?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={resetPwForm.handleSubmit(onResetPassword)} className="space-y-4">
            <div className="space-y-1">
              <Label>New Password *</Label>
              <Input type="password" {...resetPwForm.register('newPassword')} />
              {resetPwForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {resetPwForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Confirm Password *</Label>
              <Input type="password" {...resetPwForm.register('confirmPassword')} />
              {resetPwForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {resetPwForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetPwDialog({ open: false, user: null })}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Resetting...' : 'Reset Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: open ? deleteDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.user?.username}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteUser}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
