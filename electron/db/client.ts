import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'collection.db')

    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }

    db = new Database(dbPath)

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('synchronous = NORMAL')
    db.pragma('temp_store = MEMORY')
    db.pragma('mmap_size = 268435456') // 256MB
  }

  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}

export default getDb
