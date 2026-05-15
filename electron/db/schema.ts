import type Database from 'better-sqlite3'

export function createSchema(db: Database.Database): void {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      parent_id INTEGER REFERENCES categories(id),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Locations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accession_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES categories(id),
      location_id INTEGER REFERENCES locations(id),
      status TEXT NOT NULL DEFAULT 'storage',
      acquisition_date TEXT,
      acquisition_method TEXT,
      donor_name TEXT,
      estimated_value REAL,
      condition_rating TEXT,
      provenance TEXT,
      notes TEXT,
      image_paths TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Audit log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      changed_by INTEGER REFERENCES users(id),
      changed_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // TOTP recovery codes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS totp_recovery_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      title, description, accession_number, tags, provenance,
      content='items', content_rowid='id'
    )
  `)

  // Triggers to keep FTS5 in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
      INSERT INTO items_fts(rowid, title, description, accession_number, tags, provenance)
      VALUES (new.id, new.title, new.description, new.accession_number, new.tags, new.provenance);
    END
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
      INSERT INTO items_fts(items_fts, rowid, title, description, accession_number, tags, provenance)
      VALUES ('delete', old.id, old.title, old.description, old.accession_number, old.tags, old.provenance);
    END
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
      INSERT INTO items_fts(items_fts, rowid, title, description, accession_number, tags, provenance)
      VALUES ('delete', old.id, old.title, old.description, old.accession_number, old.tags, old.provenance);
      INSERT INTO items_fts(rowid, title, description, accession_number, tags, provenance)
      VALUES (new.id, new.title, new.description, new.accession_number, new.tags, new.provenance);
    END
  `)

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
    CREATE INDEX IF NOT EXISTS idx_items_location ON items(location_id);
    CREATE INDEX IF NOT EXISTS idx_items_accession ON items(accession_number);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON audit_log(changed_by);
  `)

  // Trigger to update users.updated_at
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS users_updated_at AFTER UPDATE ON users BEGIN
      UPDATE users SET updated_at = datetime('now') WHERE id = new.id;
    END
  `)

  // Trigger to update items.updated_at
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS items_updated_at AFTER UPDATE ON items BEGIN
      UPDATE items SET updated_at = datetime('now') WHERE id = new.id;
    END
  `)
}
