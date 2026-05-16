import { ipcMain, dialog, app } from 'electron'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import { getDb } from '../db/client'
import { requireAuth } from '../auth/session'
import { hashPassword, validatePasswordStrength } from '../auth/password'
import { seedDemoData } from '../db/seed'

const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(12),
  fullName: z.string().optional().nullable(),
  role: z.enum(['admin', 'editor', 'viewer'])
})

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().optional().nullable(),
  role: z.enum(['admin', 'editor', 'viewer']).optional()
})

const AuditLogParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
  tableName: z.string().optional(),
  action: z.string().optional()
}).optional()

async function requireAdmin(event: Electron.IpcMainInvokeEvent) {
  const user = await requireAuth(event)
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return user
}

export function registerAdminHandlers(): void {
  // List users
  ipcMain.handle('admin:users:list', async (event) => {
    await requireAdmin(event)
    const db = getDb()
    return db.prepare(`
      SELECT id, username, email, full_name, role, totp_enabled,
        failed_attempts, locked_until, created_at, updated_at
      FROM users
      ORDER BY created_at ASC
    `).all()
  })

  // Create user
  ipcMain.handle('admin:users:create', async (event, data: unknown) => {
    await requireAdmin(event)
    const parsed = CreateUserSchema.parse(data)

    const validation = validatePasswordStrength(parsed.password)
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    const db = getDb()

    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(parsed.username)
    if (existingUsername) throw new Error(`Username "${parsed.username}" already exists`)

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.email)
    if (existingEmail) throw new Error(`Email "${parsed.email}" already exists`)

    const passwordHash = hashPassword(parsed.password)
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(parsed.username, parsed.email, passwordHash, parsed.fullName || null, parsed.role)

    return { id: result.lastInsertRowid }
  })

  // Update user
  ipcMain.handle('admin:users:update', async (event, id: unknown, data: unknown) => {
    await requireAdmin(event)
    const userId = z.number().int().positive().parse(id)
    const parsed = UpdateUserSchema.parse(data)
    const db = getDb()

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
    if (!existing) throw new Error('User not found')

    const updates: string[] = []
    const values: unknown[] = []

    if (parsed.email !== undefined) {
      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(parsed.email, userId)
      if (dup) throw new Error(`Email "${parsed.email}" already exists`)
      updates.push('email = ?')
      values.push(parsed.email)
    }
    if (parsed.fullName !== undefined) { updates.push('full_name = ?'); values.push(parsed.fullName) }
    if (parsed.role !== undefined) { updates.push('role = ?'); values.push(parsed.role) }

    if (updates.length === 0) return { success: true }

    values.push(userId)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return { success: true }
  })

  // Delete user
  ipcMain.handle('admin:users:delete', async (event, id: unknown) => {
    const currentUser = await requireAdmin(event)
    const userId = z.number().int().positive().parse(id)

    if (userId === currentUser.id) {
      throw new Error('You cannot delete your own account')
    }

    const db = getDb()
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
    if (!existing) throw new Error('User not found')

    // Check if only admin
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number }
    const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string }
    if (targetUser.role === 'admin' && adminCount.count <= 1) {
      throw new Error('Cannot delete the last admin account')
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    return { success: true }
  })

  // Reset password
  ipcMain.handle('admin:users:reset-password', async (event, id: unknown, newPassword: unknown) => {
    await requireAdmin(event)
    const userId = z.number().int().positive().parse(id)
    const password = z.string().min(12).parse(newPassword)

    const validation = validatePasswordStrength(password)
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    const db = getDb()
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
    if (!existing) throw new Error('User not found')

    const passwordHash = hashPassword(password)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId)

    return { success: true }
  })

  // List audit log
  ipcMain.handle('admin:audit-log:list', async (event, params: unknown) => {
    await requireAuth(event)
    const parsed = AuditLogParamsSchema.parse(params)
    const page = parsed?.page || 1
    const limit = parsed?.limit || 50
    const offset = (page - 1) * limit

    const db = getDb()
    const conditions: string[] = []
    const values: unknown[] = []

    if (parsed?.tableName) {
      conditions.push('al.table_name = ?')
      values.push(parsed.tableName)
    }
    if (parsed?.action) {
      conditions.push('al.action = ?')
      values.push(parsed.action)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const total = (db.prepare(`
      SELECT COUNT(*) as count FROM audit_log al ${whereClause}
    `).get(...values) as { count: number }).count

    const entries = db.prepare(`
      SELECT al.*, u.username
      FROM audit_log al
      LEFT JOIN users u ON al.changed_by = u.id
      ${whereClause}
      ORDER BY al.changed_at DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset)

    return {
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  })

  // Database backup
  ipcMain.handle('admin:database:backup', async (event) => {
    await requireAdmin(event)

    const saveResult = await dialog.showSaveDialog({
      title: 'Save Database Backup',
      defaultPath: `museum-backup-${new Date().toISOString().split('T')[0]}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, reason: 'cancelled' }
    }

    const db = getDb()
    await db.backup(saveResult.filePath)

    return { success: true, filePath: saveResult.filePath }
  })

  // Database restore
  ipcMain.handle('admin:database:restore', async (event) => {
    await requireAdmin(event)

    const openResult = await dialog.showOpenDialog({
      title: 'Restore Database from Backup',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
    })

    if (openResult.canceled || openResult.filePaths.length === 0) {
      return { success: false, reason: 'cancelled' }
    }

    const backupPath = openResult.filePaths[0]
    const currentDbPath = path.join(app.getPath('userData'), 'collection.db')
    const tempPath = `${currentDbPath}.restore-backup`

    // Backup current db before restore
    fs.copyFileSync(currentDbPath, tempPath)

    try {
      fs.copyFileSync(backupPath, currentDbPath)
      return { success: true }
    } catch (err) {
      // Restore original on failure
      fs.copyFileSync(tempPath, currentDbPath)
      throw err
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
    }
  })

  // Import demo data
  ipcMain.handle('admin:demo:import', async (event) => {
    const user = await requireAdmin(event)
    const db = getDb()
    const counts = seedDemoData(db, user.id)
    return { success: true, ...counts }
  })

  // Clear demo data (removes items/categories/locations whose accession numbers match seed pattern)
  ipcMain.handle('admin:demo:clear', async (event) => {
    await requireAdmin(event)
    const db = getDb()
    const deleteItems = db.prepare(`
      DELETE FROM items WHERE accession_number GLOB '20??.0??.00?'
    `)
    const { changes: items } = deleteItems.run()
    // Remove categories and locations that are now empty
    db.prepare(`
      DELETE FROM categories WHERE id NOT IN (SELECT DISTINCT category_id FROM items WHERE category_id IS NOT NULL)
        AND name IN (
          'Fine Art','Decorative Arts','Archaeology','Natural History','Photography & Media',
          'Paintings','Sculptures','Drawings & Prints','Ceramics & Pottery','Textiles & Costumes',
          'Furniture','Classical Antiquities','Pre-Columbian','Fossils & Minerals'
        )
    `).run()
    db.prepare(`
      DELETE FROM locations WHERE id NOT IN (SELECT DISTINCT location_id FROM items WHERE location_id IS NOT NULL)
        AND name IN (
          'Main Gallery','East Wing Gallery','West Wing Gallery',
          'Archive Storage A','Archive Storage B','Conservation Lab',
          'City Library Loan','University Loan'
        )
    `).run()
    return { success: true, items }
  })
}
