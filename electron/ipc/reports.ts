import { ipcMain } from 'electron'
import { getDb } from '../db/client'

export function registerReportsHandlers(): void {
  // Overview: total items, by status, by condition, total value
  ipcMain.handle('reports:overview', async () => {
    const db = getDb()

    const totalItems = (db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number }).count
    const totalValue = (db.prepare('SELECT SUM(estimated_value) as total FROM items').get() as { total: number | null }).total || 0

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM items
      GROUP BY status
      ORDER BY count DESC
    `).all() as Array<{ status: string; count: number }>

    const byCondition = db.prepare(`
      SELECT
        COALESCE(condition_rating, 'unknown') as condition_rating,
        COUNT(*) as count
      FROM items
      GROUP BY condition_rating
      ORDER BY count DESC
    `).all() as Array<{ condition_rating: string; count: number }>

    const recentItems = db.prepare(`
      SELECT i.id, i.accession_number, i.title, i.status, i.condition_rating, i.created_at,
        c.name as category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `).all()

    const recentActivity = db.prepare(`
      SELECT al.*, u.username
      FROM audit_log al
      LEFT JOIN users u ON al.changed_by = u.id
      WHERE al.table_name = 'items'
      ORDER BY al.changed_at DESC
      LIMIT 10
    `).all()

    return {
      totalItems,
      totalValue,
      byStatus,
      byCondition,
      recentItems,
      recentActivity
    }
  })

  // Items by location
  ipcMain.handle('reports:by-location', async () => {
    const db = getDb()

    const byLocation = db.prepare(`
      SELECT
        l.id,
        l.name,
        l.type,
        COUNT(i.id) as item_count,
        SUM(i.estimated_value) as total_value
      FROM locations l
      LEFT JOIN items i ON i.location_id = l.id
      GROUP BY l.id, l.name, l.type
      ORDER BY item_count DESC
    `).all()

    const unlocated = (db.prepare(`
      SELECT COUNT(*) as count FROM items WHERE location_id IS NULL
    `).get() as { count: number }).count

    return { byLocation, unlocated }
  })

  // Acquisition timeline: items per month/year
  ipcMain.handle('reports:acquisition-timeline', async () => {
    const db = getDb()

    const byYear = db.prepare(`
      SELECT
        STRFTIME('%Y', acquisition_date) as year,
        COUNT(*) as count,
        SUM(estimated_value) as total_value
      FROM items
      WHERE acquisition_date IS NOT NULL
      GROUP BY year
      ORDER BY year ASC
    `).all() as Array<{ year: string; count: number; total_value: number | null }>

    const byMonth = db.prepare(`
      SELECT
        STRFTIME('%Y-%m', acquisition_date) as month,
        COUNT(*) as count,
        SUM(estimated_value) as total_value
      FROM items
      WHERE acquisition_date IS NOT NULL
        AND acquisition_date >= DATE('now', '-2 years')
      GROUP BY month
      ORDER BY month ASC
    `).all() as Array<{ month: string; count: number; total_value: number | null }>

    const byMethod = db.prepare(`
      SELECT
        COALESCE(acquisition_method, 'Unknown') as method,
        COUNT(*) as count
      FROM items
      GROUP BY acquisition_method
      ORDER BY count DESC
    `).all()

    return { byYear, byMonth, byMethod }
  })

  // Condition summary
  ipcMain.handle('reports:condition-summary', async () => {
    const db = getDb()

    const conditionBreakdown = db.prepare(`
      SELECT
        COALESCE(condition_rating, 'unknown') as condition_rating,
        COUNT(*) as count,
        SUM(estimated_value) as total_value
      FROM items
      GROUP BY condition_rating
    `).all()

    const byCategory = db.prepare(`
      SELECT
        COALESCE(c.name, 'Uncategorized') as category_name,
        i.condition_rating,
        COUNT(*) as count
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      GROUP BY c.name, i.condition_rating
      ORDER BY c.name, i.condition_rating
    `).all()

    const itemsNeedingAttention = db.prepare(`
      SELECT i.*,
        c.name as category_name,
        l.name as location_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN locations l ON i.location_id = l.id
      WHERE i.condition_rating IN ('poor', 'critical')
      ORDER BY
        CASE i.condition_rating
          WHEN 'critical' THEN 0
          WHEN 'poor' THEN 1
          ELSE 2
        END,
        i.estimated_value DESC
      LIMIT 20
    `).all()

    return { conditionBreakdown, byCategory, itemsNeedingAttention }
  })
}
