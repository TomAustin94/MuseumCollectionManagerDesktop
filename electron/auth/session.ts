import { v4 as uuidv4 } from 'uuid'
import { safeStorage, app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { IpcMainInvokeEvent } from 'electron'
import { getDb } from '../db/client'

const SESSION_DURATION_HOURS = 8

function sessionFilePath(): string {
  return path.join(app.getPath('userData'), '.session')
}

export interface User {
  id: number
  username: string
  email: string
  full_name: string | null
  role: string
  totp_enabled: number
  created_at: string
}

export function createSession(userId: number): string {
  const db = getDb()
  const token = uuidv4()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt)
  return token
}

export function validateSession(token: string): User | null {
  if (!token) return null
  const db = getDb()
  const user = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.totp_enabled, u.created_at
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).get(token) as User | undefined
  return user ?? null
}

export function destroySession(token: string): void {
  if (!token) return
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(token)
}

export async function storeSessionToken(token: string): Promise<void> {
  try {
    const file = sessionFilePath()
    if (safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(file, safeStorage.encryptString(token))
    } else {
      fs.writeFileSync(file, token, 'utf8')
    }
  } catch {
    // Non-fatal: user will need to log in again next launch
  }
}

export async function getStoredToken(): Promise<string | null> {
  try {
    const file = sessionFilePath()
    if (!fs.existsSync(file)) return null
    const data = fs.readFileSync(file)
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(data)
    }
    return data.toString('utf8')
  } catch {
    return null
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    const file = sessionFilePath()
    if (fs.existsSync(file)) fs.unlinkSync(file)
  } catch {
    // Ignore
  }
}

export async function requireAuth(_event: IpcMainInvokeEvent): Promise<User> {
  const token = await getStoredToken()
  if (!token) throw new Error('Unauthorized: No session token')
  const user = validateSession(token)
  if (!user) {
    await clearStoredToken()
    throw new Error('Unauthorized: Invalid or expired session')
  }
  return user
}

export function cleanupExpiredSessions(): void {
  getDb().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run()
}
