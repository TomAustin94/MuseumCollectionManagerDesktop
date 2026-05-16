import { ipcMain, dialog, app } from 'electron'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import { getDb } from '../db/client'
import { requireAuth } from '../auth/session'

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

const ItemListSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
  status: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  conditionRating: z.string().optional()
})

const MoveSchema = z.object({
  locationId: z.number().int().positive().optional().nullable(),
  status: z.enum(['storage', 'display', 'loan', 'conservation', 'deaccessioned'])
})

function logAudit(
  tableName: string,
  recordId: number,
  action: string,
  oldData: unknown,
  newData: unknown,
  changedBy: number
): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    tableName,
    recordId,
    action,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
    changedBy
  )
}

export function registerItemsHandlers(): void {
  // List items with pagination and filters
  ipcMain.handle('items:list', async (_event, params: unknown) => {
    const parsed = ItemListSchema.parse(params || {})
    const db = getDb()

    const conditions: string[] = []
    const bindValues: unknown[] = []

    if (parsed.status) {
      conditions.push('i.status = ?')
      bindValues.push(parsed.status)
    }
    if (parsed.categoryId) {
      conditions.push('i.category_id = ?')
      bindValues.push(parsed.categoryId)
    }
    if (parsed.locationId) {
      conditions.push('i.location_id = ?')
      bindValues.push(parsed.locationId)
    }
    if (parsed.conditionRating) {
      conditions.push('i.condition_rating = ?')
      bindValues.push(parsed.conditionRating)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (parsed.page - 1) * parsed.limit

    const countRow = db.prepare(`
      SELECT COUNT(*) as total FROM items i ${whereClause}
    `).get(...bindValues) as { total: number }

    const items = db.prepare(`
      SELECT i.*,
        c.name as category_name,
        l.name as location_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN locations l ON i.location_id = l.id
      ${whereClause}
      ORDER BY i.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...bindValues, parsed.limit, offset) as Record<string, unknown>[]

    return {
      items: items.map((item) => ({
        ...item,
        imagePaths: JSON.parse((item.image_paths as string) || '[]'),
        tags: JSON.parse((item.tags as string) || '[]')
      })),
      total: countRow.total,
      page: parsed.page,
      limit: parsed.limit,
      totalPages: Math.ceil(countRow.total / parsed.limit)
    }
  })

  // Get single item
  ipcMain.handle('items:get', async (_event, id: unknown) => {
    const itemId = z.number().int().positive().parse(id)
    const db = getDb()

    const item = db.prepare(`
      SELECT i.*,
        c.name as category_name,
        l.name as location_name,
        u1.username as created_by_username,
        u2.username as updated_by_username
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN locations l ON i.location_id = l.id
      LEFT JOIN users u1 ON i.created_by = u1.id
      LEFT JOIN users u2 ON i.updated_by = u2.id
      WHERE i.id = ?
    `).get(itemId) as Record<string, unknown> | undefined

    if (!item) throw new Error('Item not found')

    return {
      ...item,
      imagePaths: JSON.parse((item.image_paths as string) || '[]'),
      tags: JSON.parse((item.tags as string) || '[]')
    }
  })

  // Create item
  ipcMain.handle('items:create', async (event, data: unknown) => {
    const user = await requireAuth(event)
    const parsed = ItemCreateSchema.parse(data)
    const db = getDb()

    // Check for duplicate accession number
    const existing = db.prepare('SELECT id FROM items WHERE accession_number = ?').get(parsed.accessionNumber)
    if (existing) {
      throw new Error(`Accession number "${parsed.accessionNumber}" already exists`)
    }

    const stmt = db.prepare(`
      INSERT INTO items (
        accession_number, title, description, category_id, location_id,
        status, acquisition_date, acquisition_method, donor_name,
        estimated_value, condition_rating, provenance, notes,
        image_paths, tags, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      parsed.accessionNumber,
      parsed.title,
      parsed.description || null,
      parsed.categoryId || null,
      parsed.locationId || null,
      parsed.status,
      parsed.acquisitionDate || null,
      parsed.acquisitionMethod || null,
      parsed.donorName || null,
      parsed.estimatedValue || null,
      parsed.conditionRating || null,
      parsed.provenance || null,
      parsed.notes || null,
      JSON.stringify(parsed.imagePaths),
      JSON.stringify(parsed.tags),
      user.id,
      user.id
    )

    const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid)
    logAudit('items', Number(result.lastInsertRowid), 'INSERT', null, newItem, user.id)

    return { id: result.lastInsertRowid }
  })

  // Update item
  ipcMain.handle('items:update', async (event, id: unknown, data: unknown) => {
    const user = await requireAuth(event)
    const itemId = z.number().int().positive().parse(id)
    const parsed = ItemUpdateSchema.parse(data)
    const db = getDb()

    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Record<string, unknown> | undefined
    if (!existing) throw new Error('Item not found')

    // Optimistic concurrency check
    if (parsed.updatedAt && existing.updated_at !== parsed.updatedAt) {
      throw new Error('CONFLICT: This item was modified by someone else since you opened it. Reload the page to see the latest version.')
    }

    // Check for duplicate accession number if changing it
    if (parsed.accessionNumber && parsed.accessionNumber !== existing.accession_number) {
      const dup = db.prepare('SELECT id FROM items WHERE accession_number = ? AND id != ?').get(
        parsed.accessionNumber,
        itemId
      )
      if (dup) {
        throw new Error(`Accession number "${parsed.accessionNumber}" already exists`)
      }
    }

    const updates: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      accessionNumber: 'accession_number',
      title: 'title',
      description: 'description',
      categoryId: 'category_id',
      locationId: 'location_id',
      status: 'status',
      acquisitionDate: 'acquisition_date',
      acquisitionMethod: 'acquisition_method',
      donorName: 'donor_name',
      estimatedValue: 'estimated_value',
      conditionRating: 'condition_rating',
      provenance: 'provenance',
      notes: 'notes'
    }

    for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
      if (jsKey in parsed) {
        updates.push(`${dbKey} = ?`)
        values.push((parsed as Record<string, unknown>)[jsKey] ?? null)
      }
    }

    if (parsed.imagePaths !== undefined) {
      updates.push('image_paths = ?')
      values.push(JSON.stringify(parsed.imagePaths))
    }
    if (parsed.tags !== undefined) {
      updates.push('tags = ?')
      values.push(JSON.stringify(parsed.tags))
    }

    updates.push('updated_by = ?')
    values.push(user.id)

    if (updates.length === 1) {
      return { success: true } // only updated_by, nothing to update
    }

    values.push(itemId)
    db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId)
    logAudit('items', itemId, 'UPDATE', existing, updated, user.id)

    return { success: true }
  })

  // Delete item
  ipcMain.handle('items:delete', async (event, id: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin' && user.role !== 'editor') {
      throw new Error('Insufficient permissions to delete items')
    }

    const itemId = z.number().int().positive().parse(id)
    const db = getDb()

    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId)
    if (!existing) throw new Error('Item not found')

    db.prepare('DELETE FROM items WHERE id = ?').run(itemId)
    logAudit('items', itemId, 'DELETE', existing, null, user.id)

    return { success: true }
  })

  // Search items using FTS5
  ipcMain.handle('items:search', async (_event, query: unknown, params: unknown) => {
    const searchQuery = z.string().min(1).max(500).parse(query)
    const searchParams = z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(200).default(50)
    }).parse(params || {})

    const db = getDb()
    const offset = (searchParams.page - 1) * searchParams.limit

    try {
      // Try FTS5 search first
      const items = db.prepare(`
        SELECT i.*,
          c.name as category_name,
          l.name as location_name
        FROM items_fts
        JOIN items i ON items_fts.rowid = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN locations l ON i.location_id = l.id
        WHERE items_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `).all(searchQuery, searchParams.limit, offset) as Record<string, unknown>[]

      const countRow = db.prepare(`
        SELECT COUNT(*) as total FROM items_fts WHERE items_fts MATCH ?
      `).get(searchQuery) as { total: number }

      return {
        items: items.map((item) => ({
          ...item,
          imagePaths: JSON.parse((item.image_paths as string) || '[]'),
          tags: JSON.parse((item.tags as string) || '[]')
        })),
        total: countRow.total,
        page: searchParams.page,
        limit: searchParams.limit
      }
    } catch {
      // Fallback to LIKE search
      const likeQuery = `%${searchQuery}%`
      const items = db.prepare(`
        SELECT i.*,
          c.name as category_name,
          l.name as location_name
        FROM items i
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN locations l ON i.location_id = l.id
        WHERE i.title LIKE ? OR i.accession_number LIKE ? OR i.description LIKE ?
        ORDER BY i.updated_at DESC
        LIMIT ? OFFSET ?
      `).all(likeQuery, likeQuery, likeQuery, searchParams.limit, offset) as Record<string, unknown>[]

      const countRow = db.prepare(`
        SELECT COUNT(*) as total FROM items
        WHERE title LIKE ? OR accession_number LIKE ? OR description LIKE ?
      `).get(likeQuery, likeQuery, likeQuery) as { total: number }

      return {
        items: items.map((item) => ({
          ...item,
          imagePaths: JSON.parse((item.image_paths as string) || '[]'),
          tags: JSON.parse((item.tags as string) || '[]')
        })),
        total: countRow.total,
        page: searchParams.page,
        limit: searchParams.limit
      }
    }
  })

  // Move item
  ipcMain.handle('items:move', async (event, id: unknown, data: unknown) => {
    const user = await requireAuth(event)
    const itemId = z.number().int().positive().parse(id)
    const parsed = MoveSchema.parse(data)
    const db = getDb()

    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as Record<string, unknown> | undefined
    if (!existing) throw new Error('Item not found')

    db.prepare('UPDATE items SET status = ?, location_id = ?, updated_by = ? WHERE id = ?').run(
      parsed.status,
      parsed.locationId ?? null,
      user.id,
      itemId
    )

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId)
    logAudit('items', itemId, 'MOVE', existing, updated, user.id)

    return { success: true }
  })

  // Upload image for item
  ipcMain.handle('items:upload-image', async (event, id: unknown) => {
    const user = await requireAuth(event)
    const itemId = z.number().int().positive().parse(id)
    const db = getDb()

    const item = db.prepare('SELECT image_paths FROM items WHERE id = ?').get(itemId) as
      | { image_paths: string }
      | undefined
    if (!item) throw new Error('Item not found')

    const result = await dialog.showOpenDialog({
      title: 'Select Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      properties: ['openFile', 'multiSelections']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, imagePaths: JSON.parse(item.image_paths || '[]') }
    }

    const imagesDir = path.join(app.getPath('userData'), 'images', String(itemId))
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }

    const existingPaths: string[] = JSON.parse(item.image_paths || '[]')
    const newPaths: string[] = []

    for (const filePath of result.filePaths) {
      const ext = path.extname(filePath)
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`
      const destPath = path.join(imagesDir, filename)
      fs.copyFileSync(filePath, destPath)
      newPaths.push(destPath)
    }

    const allPaths = [...existingPaths, ...newPaths]
    db.prepare('UPDATE items SET image_paths = ?, updated_by = ? WHERE id = ?').run(
      JSON.stringify(allPaths),
      user.id,
      itemId
    )

    return { success: true, imagePaths: allPaths }
  })
}
