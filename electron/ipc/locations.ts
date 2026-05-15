import { ipcMain } from 'electron'
import { z } from 'zod'
import { getDb } from '../db/client'
import { requireAuth } from '../auth/session'

const LocationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['gallery', 'storage', 'conservation', 'loan', 'other']),
  description: z.string().optional().nullable()
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

export function registerLocationsHandlers(): void {
  ipcMain.handle('locations:list', async () => {
    const db = getDb()
    const locations = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM items i WHERE i.location_id = l.id) as item_count
      FROM locations l
      ORDER BY l.type, l.name
    `).all()
    return locations
  })

  ipcMain.handle('locations:get', async (_event, id: unknown) => {
    const locId = z.number().int().positive().parse(id)
    const db = getDb()
    const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(locId)
    if (!location) throw new Error('Location not found')
    return location
  })

  ipcMain.handle('locations:create', async (event, data: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin' && user.role !== 'editor') {
      throw new Error('Insufficient permissions')
    }

    const parsed = LocationSchema.parse(data)
    const db = getDb()

    const result = db.prepare(`
      INSERT INTO locations (name, type, description) VALUES (?, ?, ?)
    `).run(parsed.name, parsed.type, parsed.description || null)

    const newLoc = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid)
    logAudit('locations', Number(result.lastInsertRowid), 'INSERT', null, newLoc, user.id)

    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('locations:update', async (event, id: unknown, data: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin' && user.role !== 'editor') {
      throw new Error('Insufficient permissions')
    }

    const locId = z.number().int().positive().parse(id)
    const parsed = LocationSchema.partial().parse(data)
    const db = getDb()

    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(locId)
    if (!existing) throw new Error('Location not found')

    const updates: string[] = []
    const values: unknown[] = []

    if (parsed.name !== undefined) { updates.push('name = ?'); values.push(parsed.name) }
    if (parsed.type !== undefined) { updates.push('type = ?'); values.push(parsed.type) }
    if (parsed.description !== undefined) { updates.push('description = ?'); values.push(parsed.description) }

    if (updates.length === 0) return { success: true }

    values.push(locId)
    db.prepare(`UPDATE locations SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(locId)
    logAudit('locations', locId, 'UPDATE', existing, updated, user.id)

    return { success: true }
  })

  ipcMain.handle('locations:delete', async (event, id: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin') {
      throw new Error('Only admins can delete locations')
    }

    const locId = z.number().int().positive().parse(id)
    const db = getDb()

    const existing = db.prepare('SELECT * FROM locations WHERE id = ?').get(locId)
    if (!existing) throw new Error('Location not found')

    const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE location_id = ?').get(locId) as { count: number }
    if (itemCount.count > 0) {
      throw new Error(`Cannot delete location: ${itemCount.count} item(s) are using it`)
    }

    db.prepare('DELETE FROM locations WHERE id = ?').run(locId)
    logAudit('locations', locId, 'DELETE', existing, null, user.id)

    return { success: true }
  })
}
