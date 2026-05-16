import { ipcMain } from 'electron'
import { z } from 'zod'
import { getDb } from '../db/client'
import { requireAuth } from '../auth/session'

const CategorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  parentId: z.number().int().positive().optional().nullable()
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

export function registerCategoriesHandlers(): void {
  ipcMain.handle('categories:list', async () => {
    const db = getDb()
    const categories = db.prepare(`
      SELECT c.*,
        p.name as parent_name,
        (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id) as item_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY p.name NULLS FIRST, c.name
    `).all()
    return categories
  })

  ipcMain.handle('categories:get', async (_event, id: unknown) => {
    const catId = z.number().int().positive().parse(id)
    const db = getDb()
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId)
    if (!category) throw new Error('Category not found')
    return category
  })

  ipcMain.handle('categories:create', async (event, data: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin' && user.role !== 'editor') {
      throw new Error('Insufficient permissions')
    }

    const parsed = CategorySchema.parse(data)
    const db = getDb()

    const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(parsed.name)
    if (existing) throw new Error(`Category "${parsed.name}" already exists`)

    const result = db.prepare(`
      INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)
    `).run(parsed.name, parsed.description || null, parsed.parentId || null)

    const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
    logAudit('categories', Number(result.lastInsertRowid), 'INSERT', null, newCat, user.id)

    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('categories:update', async (event, id: unknown, data: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin' && user.role !== 'editor') {
      throw new Error('Insufficient permissions')
    }

    const catId = z.number().int().positive().parse(id)
    const parsed = CategorySchema.partial().parse(data)
    const db = getDb()

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId)
    if (!existing) throw new Error('Category not found')

    if (parsed.name) {
      const dup = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(parsed.name, catId)
      if (dup) throw new Error(`Category "${parsed.name}" already exists`)
    }

    const updates: string[] = []
    const values: unknown[] = []

    if (parsed.name !== undefined) { updates.push('name = ?'); values.push(parsed.name) }
    if (parsed.description !== undefined) { updates.push('description = ?'); values.push(parsed.description) }
    if (parsed.parentId !== undefined) { updates.push('parent_id = ?'); values.push(parsed.parentId) }

    if (updates.length === 0) return { success: true }

    values.push(catId)
    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId)
    logAudit('categories', catId, 'UPDATE', existing, updated, user.id)

    return { success: true }
  })

  ipcMain.handle('categories:delete', async (event, id: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin' && user.role !== 'editor') {
      throw new Error('Insufficient permissions to delete categories')
    }

    const catId = z.number().int().positive().parse(id)
    const db = getDb()

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId)
    if (!existing) throw new Error('Category not found')

    // Check for items using this category
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE category_id = ?').get(catId) as { count: number }
    if (itemCount.count > 0) {
      throw new Error(`Cannot delete category: ${itemCount.count} item(s) are using it`)
    }

    // Check for child categories
    const childCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(catId) as { count: number }
    if (childCount.count > 0) {
      throw new Error(`Cannot delete category: it has ${childCount.count} sub-categor(y/ies)`)
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(catId)
    logAudit('categories', catId, 'DELETE', existing, null, user.id)

    return { success: true }
  })
}
