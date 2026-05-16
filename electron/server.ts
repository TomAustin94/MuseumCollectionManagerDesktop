import express from 'express'
import { createServer, Server } from 'http'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from './db/client'
import { validateSession, createSession, destroySession, User } from './auth/session'
import { verifyPassword, hashPassword, validatePasswordStrength } from './auth/password'
import {
  generateSecret,
  generateQrCode,
  verifyToken,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  storeRecoveryCodes
} from './auth/totp'
import { seedDemoData } from './db/seed'

type AuthedRequest = express.Request & { user: User }

const pendingMfa = new Map<string, { userId: number; expiresAt: number }>()

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const user = validateSession(header.slice(7))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  ;(req as AuthedRequest).user = user
  next()
}

function handleError(res: express.Response, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  res.status(400).json({ error: msg })
}

function logAudit(
  tableName: string,
  recordId: number,
  action: string,
  oldData: unknown,
  newData: unknown,
  changedBy: number
): void {
  const db = getDb()
  db.prepare(
    'INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    tableName,
    recordId,
    action,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
    changedBy
  )
}

// ── Zod schemas (mirroring ipc handlers) ──────────────────────────────────

const ItemListSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
  status: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  conditionRating: z.string().optional()
})

const ItemCreateSchema = z.object({
  accessionNumber: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  categoryId: z.number().int().positive().optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  status: z.enum(['storage', 'display', 'loan', 'conservation', 'deaccessioned']).default('storage'),
  acquisitionDate: z.string().optional().nullable(),
  acquisitionMethod: z.string().optional().nullable(),
  donorName: z.string().optional().nullable(),
  estimatedValue: z.number().optional().nullable(),
  conditionRating: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']).optional().nullable(),
  provenance: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  imagePaths: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
})

const ItemUpdateSchema = ItemCreateSchema.partial().extend({
  updatedAt: z.string().optional()
})

const MoveSchema = z.object({
  locationId: z.number().int().positive().optional().nullable(),
  status: z.enum(['storage', 'display', 'loan', 'conservation', 'deaccessioned'])
})

const CategorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  parentId: z.number().int().positive().optional().nullable()
})

const LocationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['gallery', 'storage', 'conservation', 'loan', 'other']),
  description: z.string().optional().nullable()
})

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

// ── RPC handler map ────────────────────────────────────────────────────────

type RpcHandler = (user: User, args: unknown[]) => Promise<unknown>

function itemRow(item: Record<string, unknown>) {
  return {
    ...item,
    imagePaths: JSON.parse((item.image_paths as string) || '[]'),
    tags: JSON.parse((item.tags as string) || '[]')
  }
}

const rpcHandlers: Record<string, RpcHandler> = {
  // ── Auth (requires session but operates on current user) ──────────────
  'auth:change-password': async (user, [data]) => {
    const parsed = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(12) })
      .parse(data)
    const db = getDb()
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as
      | { password_hash: string }
      | undefined
    if (!u) throw new Error('User not found')
    if (!verifyPassword(parsed.currentPassword, u.password_hash))
      throw new Error('Current password is incorrect')
    const v = validatePasswordStrength(parsed.newPassword)
    if (!v.valid) throw new Error(v.errors.join(', '))
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(parsed.newPassword),
      user.id
    )
    return { success: true }
  },

  'auth:setup-mfa': async (user) => {
    const setup = generateSecret(user.username)
    const qrCodeDataUrl = await generateQrCode(setup.qrCodeDataUrl)
    return { secret: setup.secret, qrCodeDataUrl, encryptedSecret: setup.encryptedSecret }
  },

  'auth:confirm-mfa': async (user, [data]) => {
    const parsed = z
      .object({ token: z.string().min(6).max(8), secret: z.string().min(1) })
      .parse(data)
    if (!verifyToken(parsed.secret, parsed.token)) throw new Error('Invalid TOTP token. Please try again.')
    const db = getDb()
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?').run(
      encryptSecret(parsed.secret),
      user.id
    )
    const recoveryCodes = generateRecoveryCodes()
    storeRecoveryCodes(user.id, recoveryCodes)
    return { success: true, recoveryCodes }
  },

  'auth:disable-mfa': async (user, [data]) => {
    const parsed = z.object({ token: z.string().min(6).max(8) }).parse(data)
    const db = getDb()
    const u = db
      .prepare('SELECT totp_secret FROM users WHERE id = ?')
      .get(user.id) as { totp_secret: string | null } | undefined
    if (!u?.totp_secret) throw new Error('MFA is not enabled')
    if (!verifyToken(decryptSecret(u.totp_secret), parsed.token)) throw new Error('Invalid TOTP token')
    db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(user.id)
    db.prepare('DELETE FROM totp_recovery_codes WHERE user_id = ?').run(user.id)
    return { success: true }
  },

  // ── Items ──────────────────────────────────────────────────────────────
  'items:list': async (_user, [params]) => {
    const parsed = ItemListSchema.parse(params || {})
    const db = getDb()
    const conditions: string[] = []
    const bindValues: unknown[] = []
    if (parsed.status) { conditions.push('i.status = ?'); bindValues.push(parsed.status) }
    if (parsed.categoryId) { conditions.push('i.category_id = ?'); bindValues.push(parsed.categoryId) }
    if (parsed.locationId) { conditions.push('i.location_id = ?'); bindValues.push(parsed.locationId) }
    if (parsed.conditionRating) { conditions.push('i.condition_rating = ?'); bindValues.push(parsed.conditionRating) }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (parsed.page - 1) * parsed.limit
    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM items i ${whereClause}`)
      .get(...bindValues) as { total: number }
    const items = db
      .prepare(
        `SELECT i.*, c.name as category_name, l.name as location_name
         FROM items i
         LEFT JOIN categories c ON i.category_id = c.id
         LEFT JOIN locations l ON i.location_id = l.id
         ${whereClause}
         ORDER BY i.updated_at DESC LIMIT ? OFFSET ?`
      )
      .all(...bindValues, parsed.limit, offset) as Record<string, unknown>[]
    return {
      items: items.map(itemRow),
      total: countRow.total,
      page: parsed.page,
      limit: parsed.limit,
      totalPages: Math.ceil(countRow.total / parsed.limit)
    }
  },

  'items:get': async (_user, [id]) => {
    const itemId = z.number().int().positive().parse(id)
    const db = getDb()
    const item = db
      .prepare(
        `SELECT i.*, c.name as category_name, l.name as location_name
         FROM items i
         LEFT JOIN categories c ON i.category_id = c.id
         LEFT JOIN locations l ON i.location_id = l.id
         WHERE i.id = ?`
      )
      .get(itemId) as Record<string, unknown> | undefined
    if (!item) throw new Error('Item not found')
    return itemRow(item)
  },

  'items:create': async (user, [data]) => {
    const parsed = ItemCreateSchema.parse(data)
    const db = getDb()
    const existing = db
      .prepare('SELECT id FROM items WHERE accession_number = ?')
      .get(parsed.accessionNumber)
    if (existing) throw new Error(`Accession number "${parsed.accessionNumber}" already exists`)
    const result = db
      .prepare(
        `INSERT INTO items (accession_number, title, description, category_id, location_id, status,
          acquisition_date, acquisition_method, donor_name, estimated_value, condition_rating,
          provenance, notes, image_paths, tags, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        parsed.accessionNumber, parsed.title, parsed.description || null,
        parsed.categoryId || null, parsed.locationId || null, parsed.status,
        parsed.acquisitionDate || null, parsed.acquisitionMethod || null, parsed.donorName || null,
        parsed.estimatedValue || null, parsed.conditionRating || null, parsed.provenance || null,
        parsed.notes || null, JSON.stringify(parsed.imagePaths), JSON.stringify(parsed.tags),
        user.id, user.id
      )
    const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid)
    logAudit('items', Number(result.lastInsertRowid), 'INSERT', null, newItem, user.id)
    return { id: result.lastInsertRowid }
  },

  'items:update': async (user, [id, data]) => {
    const itemId = z.number().int().positive().parse(id)
    const parsed = ItemUpdateSchema.parse(data)
    const db = getDb()
    const existing = db
      .prepare('SELECT * FROM items WHERE id = ?')
      .get(itemId) as Record<string, unknown> | undefined
    if (!existing) throw new Error('Item not found')
    if (parsed.updatedAt && existing.updated_at !== parsed.updatedAt) {
      throw new Error('CONFLICT: This item was modified by someone else since you opened it. Reload the page to see the latest version.')
    }
    if (parsed.accessionNumber && parsed.accessionNumber !== existing.accession_number) {
      const dup = db
        .prepare('SELECT id FROM items WHERE accession_number = ? AND id != ?')
        .get(parsed.accessionNumber, itemId)
      if (dup) throw new Error(`Accession number "${parsed.accessionNumber}" already exists`)
    }
    const updates: string[] = []
    const values: unknown[] = []
    const fieldMap: Record<string, string> = {
      accessionNumber: 'accession_number', title: 'title', description: 'description',
      categoryId: 'category_id', locationId: 'location_id', status: 'status',
      acquisitionDate: 'acquisition_date', acquisitionMethod: 'acquisition_method',
      donorName: 'donor_name', estimatedValue: 'estimated_value',
      conditionRating: 'condition_rating', provenance: 'provenance', notes: 'notes'
    }
    for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
      if (jsKey in parsed) { updates.push(`${dbKey} = ?`); values.push((parsed as Record<string, unknown>)[jsKey] ?? null) }
    }
    if (parsed.imagePaths !== undefined) { updates.push('image_paths = ?'); values.push(JSON.stringify(parsed.imagePaths)) }
    if (parsed.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(parsed.tags)) }
    updates.push('updated_by = ?'); values.push(user.id)
    if (updates.length === 1) return { success: true }
    values.push(itemId)
    db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId)
    logAudit('items', itemId, 'UPDATE', existing, updated, user.id)
    return { success: true }
  },

  'items:delete': async (user, [id]) => {
    if (user.role !== 'admin' && user.role !== 'editor') throw new Error('Insufficient permissions to delete items')
    const itemId = z.number().int().positive().parse(id)
    const db = getDb()
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId)
    if (!existing) throw new Error('Item not found')
    db.prepare('DELETE FROM items WHERE id = ?').run(itemId)
    logAudit('items', itemId, 'DELETE', existing, null, user.id)
    return { success: true }
  },

  'items:search': async (_user, [query, params]) => {
    const searchQuery = z.string().min(1).max(500).parse(query)
    const searchParams = z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50)
    }).parse(params || {})
    const db = getDb()
    const offset = (searchParams.page - 1) * searchParams.limit
    try {
      const items = db.prepare(
        `SELECT i.*, c.name as category_name, l.name as location_name
         FROM items_fts
         JOIN items i ON items_fts.rowid = i.id
         LEFT JOIN categories c ON i.category_id = c.id
         LEFT JOIN locations l ON i.location_id = l.id
         WHERE items_fts MATCH ? ORDER BY rank LIMIT ? OFFSET ?`
      ).all(searchQuery, searchParams.limit, offset) as Record<string, unknown>[]
      const countRow = db
        .prepare('SELECT COUNT(*) as total FROM items_fts WHERE items_fts MATCH ?')
        .get(searchQuery) as { total: number }
      return { items: items.map(itemRow), total: countRow.total, page: searchParams.page, limit: searchParams.limit }
    } catch {
      const likeQuery = `%${searchQuery}%`
      const items = db.prepare(
        `SELECT i.*, c.name as category_name, l.name as location_name
         FROM items i
         LEFT JOIN categories c ON i.category_id = c.id
         LEFT JOIN locations l ON i.location_id = l.id
         WHERE i.title LIKE ? OR i.accession_number LIKE ? OR i.description LIKE ?
         ORDER BY i.updated_at DESC LIMIT ? OFFSET ?`
      ).all(likeQuery, likeQuery, likeQuery, searchParams.limit, offset) as Record<string, unknown>[]
      const countRow = db.prepare(
        'SELECT COUNT(*) as total FROM items WHERE title LIKE ? OR accession_number LIKE ? OR description LIKE ?'
      ).get(likeQuery, likeQuery, likeQuery) as { total: number }
      return { items: items.map(itemRow), total: countRow.total, page: searchParams.page, limit: searchParams.limit }
    }
  },

  'items:move': async (user, [id, data]) => {
    const itemId = z.number().int().positive().parse(id)
    const parsed = MoveSchema.parse(data)
    const db = getDb()
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Record<string, unknown> | undefined
    if (!existing) throw new Error('Item not found')
    db.prepare('UPDATE items SET status = ?, location_id = ?, updated_by = ? WHERE id = ?').run(
      parsed.status, parsed.locationId ?? null, user.id, itemId
    )
    logAudit('items', itemId, 'MOVE', existing, db.prepare('SELECT * FROM items WHERE id = ?').get(itemId), user.id)
    return { success: true }
  },

  'items:upload-image': async () => {
    throw new Error('Image upload is not available in server mode via remote clients.')
  },

  // ── Categories ─────────────────────────────────────────────────────────
  'categories:list': async () => {
    return getDb().prepare(
      `SELECT c.*, p.name as parent_name,
        (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id) as item_count
       FROM categories c
       LEFT JOIN categories p ON c.parent_id = p.id
       ORDER BY p.name NULLS FIRST, c.name`
    ).all()
  },

  'categories:get': async (_user, [id]) => {
    const catId = z.number().int().positive().parse(id)
    const cat = getDb().prepare('SELECT * FROM categories WHERE id = ?').get(catId)
    if (!cat) throw new Error('Category not found')
    return cat
  },

  'categories:create': async (user, [data]) => {
    if (user.role !== 'admin' && user.role !== 'editor') throw new Error('Insufficient permissions')
    const parsed = CategorySchema.parse(data)
    const db = getDb()
    if (db.prepare('SELECT id FROM categories WHERE name = ?').get(parsed.name))
      throw new Error(`Category "${parsed.name}" already exists`)
    const result = db.prepare('INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)').run(
      parsed.name, parsed.description || null, parsed.parentId || null
    )
    logAudit('categories', Number(result.lastInsertRowid), 'INSERT', null,
      db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid), user.id)
    return { id: result.lastInsertRowid }
  },

  'categories:update': async (user, [id, data]) => {
    if (user.role !== 'admin' && user.role !== 'editor') throw new Error('Insufficient permissions')
    const catId = z.number().int().positive().parse(id)
    const parsed = CategorySchema.partial().parse(data)
    const db = getDb()
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId)
    if (!existing) throw new Error('Category not found')
    if (parsed.name) {
      const dup = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(parsed.name, catId)
      if (dup) throw new Error(`Category "${parsed.name}" already exists`)
    }
    const updates: string[] = []; const values: unknown[] = []
    if (parsed.name !== undefined) { updates.push('name = ?'); values.push(parsed.name) }
    if (parsed.description !== undefined) { updates.push('description = ?'); values.push(parsed.description) }
    if (parsed.parentId !== undefined) { updates.push('parent_id = ?'); values.push(parsed.parentId) }
    if (updates.length === 0) return { success: true }
    values.push(catId)
    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    logAudit('categories', catId, 'UPDATE', existing, db.prepare('SELECT * FROM categories WHERE id = ?').get(catId), user.id)
    return { success: true }
  },

  'categories:delete': async (user, [id]) => {
    if (user.role !== 'admin' && user.role !== 'editor') throw new Error('Insufficient permissions to delete categories')
    const catId = z.number().int().positive().parse(id)
    const db = getDb()
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId)
    if (!existing) throw new Error('Category not found')
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE category_id = ?').get(catId) as { count: number }
    if (itemCount.count > 0) throw new Error(`Cannot delete category: ${itemCount.count} item(s) are using it`)
    const childCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(catId) as { count: number }
    if (childCount.count > 0) throw new Error(`Cannot delete category: it has ${childCount.count} sub-categor(y/ies)`)
    db.prepare('DELETE FROM categories WHERE id = ?').run(catId)
    logAudit('categories', catId, 'DELETE', existing, null, user.id)
    return { success: true }
  },

  // ── Locations ──────────────────────────────────────────────────────────
  'locations:list': async () => {
    return getDb().prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM items i WHERE i.location_id = l.id) as item_count
       FROM locations l ORDER BY l.type, l.name`
    ).all()
  },

  'locations:get': async (_user, [id]) => {
    const locId = z.number().int().positive().parse(id)
    const loc = getDb().prepare('SELECT * FROM locations WHERE id = ?').get(locId)
    if (!loc) throw new Error('Location not found')
    return loc
  },

  'locations:create': async (user, [data]) => {
    if (user.role !== 'admin' && user.role !== 'editor') throw new Error('Insufficient permissions')
    const parsed = LocationSchema.parse(data)
    const db = getDb()
    const result = db.prepare('INSERT INTO locations (name, type, description) VALUES (?, ?, ?)').run(
      parsed.name, parsed.type, parsed.description || null
    )
    logAudit('locations', Number(result.lastInsertRowid), 'INSERT', null,
      db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid), user.id)
    return { id: result.lastInsertRowid }
  },

  'locations:update': async (user, [id, data]) => {
    if (user.role !== 'admin' && user.role !== 'editor') throw new Error('Insufficient permissions')
    const locId = z.number().int().positive().parse(id)
    const parsed = LocationSchema.partial().parse(data)
    const db = getDb()
    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(locId)
    if (!existing) throw new Error('Location not found')
    const updates: string[] = []; const values: unknown[] = []
    if (parsed.name !== undefined) { updates.push('name = ?'); values.push(parsed.name) }
    if (parsed.type !== undefined) { updates.push('type = ?'); values.push(parsed.type) }
    if (parsed.description !== undefined) { updates.push('description = ?'); values.push(parsed.description) }
    if (updates.length === 0) return { success: true }
    values.push(locId)
    db.prepare(`UPDATE locations SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    logAudit('locations', locId, 'UPDATE', existing, db.prepare('SELECT * FROM locations WHERE id = ?').get(locId), user.id)
    return { success: true }
  },

  'locations:delete': async (user, [id]) => {
    if (user.role !== 'admin' && user.role !== 'editor') throw new Error('Insufficient permissions to delete locations')
    const locId = z.number().int().positive().parse(id)
    const db = getDb()
    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(locId)
    if (!existing) throw new Error('Location not found')
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE location_id = ?').get(locId) as { count: number }
    if (itemCount.count > 0) throw new Error(`Cannot delete location: ${itemCount.count} item(s) are using it`)
    db.prepare('DELETE FROM locations WHERE id = ?').run(locId)
    logAudit('locations', locId, 'DELETE', existing, null, user.id)
    return { success: true }
  },

  // ── Reports ────────────────────────────────────────────────────────────
  'reports:overview': async () => {
    const db = getDb()
    return {
      totalItems: (db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number }).count,
      totalValue: (db.prepare('SELECT SUM(estimated_value) as total FROM items').get() as { total: number | null }).total || 0,
      byStatus: db.prepare('SELECT status, COUNT(*) as count FROM items GROUP BY status ORDER BY count DESC').all(),
      byCondition: db.prepare(`SELECT COALESCE(condition_rating,'unknown') as condition_rating, COUNT(*) as count FROM items GROUP BY condition_rating ORDER BY count DESC`).all(),
      recentItems: db.prepare(`SELECT i.id, i.accession_number, i.title, i.status, i.condition_rating, i.created_at, c.name as category_name FROM items i LEFT JOIN categories c ON i.category_id = c.id ORDER BY i.created_at DESC LIMIT 10`).all(),
      recentActivity: db.prepare(`SELECT al.*, u.username FROM audit_log al LEFT JOIN users u ON al.changed_by = u.id WHERE al.table_name = 'items' ORDER BY al.changed_at DESC LIMIT 10`).all()
    }
  },

  'reports:by-location': async () => {
    const db = getDb()
    return {
      byLocation: db.prepare(`SELECT l.id, l.name, l.type, COUNT(i.id) as item_count, SUM(i.estimated_value) as total_value FROM locations l LEFT JOIN items i ON i.location_id = l.id GROUP BY l.id, l.name, l.type ORDER BY item_count DESC`).all(),
      unlocated: (db.prepare('SELECT COUNT(*) as count FROM items WHERE location_id IS NULL').get() as { count: number }).count
    }
  },

  'reports:acquisition-timeline': async () => {
    const db = getDb()
    return {
      byYear: db.prepare(`SELECT STRFTIME('%Y', acquisition_date) as year, COUNT(*) as count, SUM(estimated_value) as total_value FROM items WHERE acquisition_date IS NOT NULL GROUP BY year ORDER BY year ASC`).all(),
      byMonth: db.prepare(`SELECT STRFTIME('%Y-%m', acquisition_date) as month, COUNT(*) as count, SUM(estimated_value) as total_value FROM items WHERE acquisition_date IS NOT NULL AND acquisition_date >= DATE('now', '-2 years') GROUP BY month ORDER BY month ASC`).all(),
      byMethod: db.prepare(`SELECT COALESCE(acquisition_method,'Unknown') as method, COUNT(*) as count FROM items GROUP BY acquisition_method ORDER BY count DESC`).all()
    }
  },

  'reports:condition-summary': async () => {
    const db = getDb()
    const itemsNeedingAttention = db.prepare(
      `SELECT i.*, c.name as category_name, l.name as location_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN locations l ON i.location_id = l.id WHERE i.condition_rating IN ('poor','critical') ORDER BY CASE i.condition_rating WHEN 'critical' THEN 0 WHEN 'poor' THEN 1 ELSE 2 END, i.estimated_value DESC LIMIT 20`
    ).all() as Record<string, unknown>[]
    return {
      conditionBreakdown: db.prepare(`SELECT COALESCE(condition_rating,'unknown') as condition_rating, COUNT(*) as count, SUM(estimated_value) as total_value FROM items GROUP BY condition_rating`).all(),
      byCategory: db.prepare(`SELECT COALESCE(c.name,'Uncategorized') as category_name, i.condition_rating, COUNT(*) as count FROM items i LEFT JOIN categories c ON i.category_id = c.id GROUP BY c.name, i.condition_rating ORDER BY c.name, i.condition_rating`).all(),
      itemsNeedingAttention: itemsNeedingAttention.map(itemRow)
    }
  },

  // ── Admin: Users ───────────────────────────────────────────────────────
  'admin:users:list': async (user) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    return getDb().prepare(`SELECT id, username, email, full_name, role, totp_enabled, failed_attempts, locked_until, created_at, updated_at FROM users ORDER BY created_at ASC`).all()
  },

  'admin:users:create': async (user, [data]) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    const parsed = CreateUserSchema.parse(data)
    const v = validatePasswordStrength(parsed.password)
    if (!v.valid) throw new Error(v.errors.join(', '))
    const db = getDb()
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(parsed.username))
      throw new Error(`Username "${parsed.username}" already exists`)
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.email))
      throw new Error(`Email "${parsed.email}" already exists`)
    const result = db.prepare('INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run(
      parsed.username, parsed.email, hashPassword(parsed.password), parsed.fullName || null, parsed.role
    )
    return { id: result.lastInsertRowid }
  },

  'admin:users:update': async (user, [id, data]) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    const userId = z.number().int().positive().parse(id)
    const parsed = UpdateUserSchema.parse(data)
    const db = getDb()
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new Error('User not found')
    const updates: string[] = []; const values: unknown[] = []
    if (parsed.email !== undefined) {
      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(parsed.email, userId)
      if (dup) throw new Error(`Email "${parsed.email}" already exists`)
      updates.push('email = ?'); values.push(parsed.email)
    }
    if (parsed.fullName !== undefined) { updates.push('full_name = ?'); values.push(parsed.fullName) }
    if (parsed.role !== undefined) { updates.push('role = ?'); values.push(parsed.role) }
    if (updates.length === 0) return { success: true }
    values.push(userId)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  },

  'admin:users:delete': async (user, [id]) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    const userId = z.number().int().positive().parse(id)
    if (userId === user.id) throw new Error('You cannot delete your own account')
    const db = getDb()
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new Error('User not found')
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number }
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string }
    if (target.role === 'admin' && adminCount.count <= 1) throw new Error('Cannot delete the last admin account')
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    return { success: true }
  },

  'admin:users:reset-password': async (user, [id, newPassword]) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    const userId = z.number().int().positive().parse(id)
    const password = z.string().min(12).parse(newPassword)
    const v = validatePasswordStrength(password)
    if (!v.valid) throw new Error(v.errors.join(', '))
    const db = getDb()
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new Error('User not found')
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId)
    return { success: true }
  },

  // ── Admin: Audit log ───────────────────────────────────────────────────
  'admin:audit-log:list': async (_user, [params]) => {
    const parsed = z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50),
      tableName: z.string().optional(),
      action: z.string().optional()
    }).optional().parse(params)
    const page = parsed?.page || 1
    const limit = parsed?.limit || 50
    const offset = (page - 1) * limit
    const db = getDb()
    const conditions: string[] = []; const values: unknown[] = []
    if (parsed?.tableName) { conditions.push('al.table_name = ?'); values.push(parsed.tableName) }
    if (parsed?.action) { conditions.push('al.action = ?'); values.push(parsed.action) }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) as count FROM audit_log al ${whereClause}`).get(...values) as { count: number }).count
    const entries = db.prepare(`SELECT al.*, u.username FROM audit_log al LEFT JOIN users u ON al.changed_by = u.id ${whereClause} ORDER BY al.changed_at DESC LIMIT ? OFFSET ?`).all(...values, limit, offset)
    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) }
  },

  // ── Admin: Demo data ───────────────────────────────────────────────────
  'admin:demo:import': async (user) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    const db = getDb()
    const counts = seedDemoData(db, user.id)
    return { success: true, ...counts }
  },

  'admin:demo:clear': async (user) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    const db = getDb()
    const { changes: items } = db.prepare("DELETE FROM items WHERE accession_number GLOB '20??.0??.00?'").run()
    db.prepare(`DELETE FROM categories WHERE id NOT IN (SELECT DISTINCT category_id FROM items WHERE category_id IS NOT NULL) AND name IN ('Fine Art','Decorative Arts','Archaeology','Natural History','Photography & Media','Paintings','Sculptures','Drawings & Prints','Ceramics & Pottery','Textiles & Costumes','Furniture','Classical Antiquities','Pre-Columbian','Fossils & Minerals')`).run()
    db.prepare(`DELETE FROM locations WHERE id NOT IN (SELECT DISTINCT location_id FROM items WHERE location_id IS NOT NULL) AND name IN ('Main Gallery','East Wing Gallery','West Wing Gallery','Archive Storage A','Archive Storage B','Conservation Lab','City Library Loan','University Loan')`).run()
    return { success: true, items }
  },

  // ── Admin: Backup/Restore (server-only, no file dialog) ────────────────
  'admin:database:backup': async (user) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    throw new Error('Database backup must be triggered from the server machine directly.')
  },

  'admin:database:restore': async (user) => {
    if (user.role !== 'admin') throw new Error('Admin access required')
    throw new Error('Database restore must be triggered from the server machine directly.')
  }
}

// ── Express app ────────────────────────────────────────────────────────────

export function createApiServer(port: number): Server {
  const app = express()
  app.use(express.json({ limit: '10mb' }))

  // ── Setup endpoints (no auth) ────────────────────────────────────────
  app.get('/api/setup/is-first-run', (_req, res) => {
    try {
      const db = getDb()
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
      res.json(row.count === 0)
    } catch (err) {
      handleError(res, err)
    }
  })

  app.post('/api/setup/create-admin', async (req, res) => {
    try {
      const db = getDb()
      const count = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count
      if (count > 0) throw new Error('Admin account already exists')
      const parsed = z
        .object({
          username: z.string().min(3).max(50),
          email: z.string().email(),
          password: z.string().min(12),
          fullName: z.string().nullable().optional()
        })
        .parse(req.body)
      const v = validatePasswordStrength(parsed.password)
      if (!v.valid) throw new Error(v.errors.join(', '))
      const result = db
        .prepare(
          "INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'admin')"
        )
        .run(parsed.username, parsed.email, hashPassword(parsed.password), parsed.fullName || null)
      res.json({ success: true, userId: result.lastInsertRowid })
    } catch (err) {
      handleError(res, err)
    }
  })

  // ── Auth endpoints (no Bearer needed for login/mfa) ──────────────────
  app.post('/api/auth/login', async (req, res) => {
    try {
      const parsed = z
        .object({ username: z.string().min(1), password: z.string().min(1) })
        .parse(req.body)
      const db = getDb()
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(parsed.username) as {
        id: number; username: string; email: string; password_hash: string; full_name: string | null
        role: string; totp_secret: string | null; totp_enabled: number; failed_attempts: number; locked_until: string | null
      } | undefined
      if (!user) throw new Error('Invalid username or password')
      if (user.locked_until) {
        const lockoutTime = new Date(user.locked_until)
        if (lockoutTime > new Date()) {
          const minutesLeft = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000)
          throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`)
        }
        db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id)
      }
      if (!verifyPassword(parsed.password, user.password_hash)) {
        const newAttempts = user.failed_attempts + 1
        if (newAttempts >= 5) {
          const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
          db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
            newAttempts, lockedUntil, user.id
          )
          throw new Error('Too many failed attempts. Account locked for 15 minutes.')
        }
        db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(newAttempts, user.id)
        throw new Error(`Invalid username or password. ${5 - newAttempts} attempt(s) remaining.`)
      }
      db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id)
      if (user.totp_enabled) {
        const tempToken = uuidv4()
        pendingMfa.set(tempToken, { userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 })
        res.json({ requiresMfa: true, tempToken })
        return
      }
      const sessionToken = createSession(user.id)
      res.json({
        requiresMfa: false,
        sessionToken,
        user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name, role: user.role, totpEnabled: false }
      })
    } catch (err) {
      handleError(res, err)
    }
  })

  app.post('/api/auth/mfa', (req, res) => {
    try {
      const parsed = z
        .object({ tempToken: z.string().min(1), totpToken: z.string().min(6).max(8) })
        .parse(req.body)
      const pending = pendingMfa.get(parsed.tempToken)
      if (!pending || pending.expiresAt < Date.now()) {
        pendingMfa.delete(parsed.tempToken)
        throw new Error('MFA session expired. Please log in again.')
      }
      const db = getDb()
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pending.userId) as {
        id: number; username: string; email: string; full_name: string | null
        role: string; totp_secret: string | null; totp_enabled: number
      } | undefined
      if (!user?.totp_secret) throw new Error('User not found or MFA not configured')
      if (!verifyToken(decryptSecret(user.totp_secret), parsed.totpToken)) throw new Error('Invalid MFA code')
      pendingMfa.delete(parsed.tempToken)
      const sessionToken = createSession(user.id)
      res.json({
        sessionToken,
        user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name, role: user.role, totpEnabled: true }
      })
    } catch (err) {
      handleError(res, err)
    }
  })

  app.delete('/api/auth/session', authMiddleware, (req, res) => {
    destroySession(req.headers.authorization!.slice(7))
    res.json({ success: true })
  })

  app.get('/api/auth/session', authMiddleware, (req, res) => {
    const u = (req as AuthedRequest).user
    res.json({
      id: u.id, username: u.username, email: u.email,
      fullName: u.full_name, role: u.role, totpEnabled: u.totp_enabled === 1
    })
  })

  // ── Generic RPC (all other channels) ────────────────────────────────
  app.post('/api/rpc', authMiddleware, async (req, res) => {
    const { channel, args = [] } = req.body as { channel: string; args: unknown[] }
    const user = (req as AuthedRequest).user
    const handler = rpcHandlers[channel]
    if (!handler) {
      res.status(404).json({ error: `Unknown channel: ${channel}` })
      return
    }
    try {
      const result = await handler(user, args)
      res.json(result)
    } catch (err) {
      handleError(res, err)
    }
  })

  const server = createServer(app)
  server.listen(port, '0.0.0.0', () => {
    console.log(`API server listening on port ${port}`)
  })
  return server
}
