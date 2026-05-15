import { getDb } from './client'
import { createSchema } from './schema'

export function runMigrations(): void {
  const db = getDb()
  createSchema(db)
  console.log('Database migrations completed successfully')
}
