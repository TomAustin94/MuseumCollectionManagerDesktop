import { ipcMain, dialog } from 'electron'
import { z } from 'zod'
import fs from 'fs'
import { stringify } from 'csv-stringify/sync'
import { getDb } from '../db/client'
import { requireAuth } from '../auth/session'

const ExportFiltersSchema = z.object({
  status: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  conditionRating: z.string().optional()
}).optional()

export function registerExportHandlers(): void {
  ipcMain.handle('export:csv', async (event, filters: unknown) => {
    await requireAuth(event)

    const parsed = ExportFiltersSchema.parse(filters)
    const db = getDb()

    const conditions: string[] = []
    const values: unknown[] = []

    if (parsed?.status) {
      conditions.push('i.status = ?')
      values.push(parsed.status)
    }
    if (parsed?.categoryId) {
      conditions.push('i.category_id = ?')
      values.push(parsed.categoryId)
    }
    if (parsed?.locationId) {
      conditions.push('i.location_id = ?')
      values.push(parsed.locationId)
    }
    if (parsed?.conditionRating) {
      conditions.push('i.condition_rating = ?')
      values.push(parsed.conditionRating)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const items = db.prepare(`
      SELECT
        i.accession_number,
        i.title,
        i.description,
        c.name as category,
        l.name as location,
        l.type as location_type,
        i.status,
        i.condition_rating,
        i.acquisition_date,
        i.acquisition_method,
        i.donor_name,
        i.estimated_value,
        i.provenance,
        i.notes,
        i.tags,
        i.created_at,
        i.updated_at
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN locations l ON i.location_id = l.id
      ${whereClause}
      ORDER BY i.accession_number
    `).all(...values) as Record<string, unknown>[]

    const saveResult = await dialog.showSaveDialog({
      title: 'Export Collection to CSV',
      defaultPath: `museum-collection-${new Date().toISOString().split('T')[0]}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, reason: 'cancelled' }
    }

    const csvData = items.map((item) => ({
      'Accession Number': item.accession_number,
      'Title': item.title,
      'Description': item.description || '',
      'Category': item.category || '',
      'Location': item.location || '',
      'Location Type': item.location_type || '',
      'Status': item.status,
      'Condition': item.condition_rating || '',
      'Acquisition Date': item.acquisition_date || '',
      'Acquisition Method': item.acquisition_method || '',
      'Donor Name': item.donor_name || '',
      'Estimated Value': item.estimated_value || '',
      'Provenance': item.provenance || '',
      'Notes': item.notes || '',
      'Tags': item.tags ? JSON.parse(item.tags as string).join('; ') : '',
      'Created At': item.created_at,
      'Updated At': item.updated_at
    }))

    const csvContent = stringify(csvData, { header: true })
    fs.writeFileSync(saveResult.filePath, csvContent, 'utf-8')

    return {
      success: true,
      filePath: saveResult.filePath,
      count: items.length
    }
  })
}
