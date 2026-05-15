import { v4 as uuidv4 } from 'uuid'
import keytar from 'keytar'
import type { IpcMainInvokeEvent } from 'electron'
import { getDb } from '../db/client'

const KEYTAR_SERVICE = 'MuseumCollectionManager'
const KEYTAR_ACCOUNT = 'session-token'
const SESSION_DURATION_HOURS = 8

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

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)
  `)
  stmt.run(token, userId, expiresAt)

  return token
}

export function validateSession(token: string): User | null {
  if (!token) return null

  const db = getDb()
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.totp_enabled, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `)

  const user = stmt.get(token) as User | undefined
  return user || null
}

export function destroySession(token: string): void {
  if (!token) return

  const db = getDb()
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?')
  stmt.run(token)
}

export async function storeSessionToken(token: string): Promise<void> {
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token)
}

export async function getStoredToken(): Promise<string | null> {
  return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
}

export async function clearStoredToken(): Promise<void> {
  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
}

export async function requireAuth(_event: IpcMainInvokeEvent): Promise<User> {
  const token = await getStoredToken()
  if (!token) {
    throw new Error('Unauthorized: No session token')
  }

  const user = validateSession(token)
  if (!user) {
    await clearStoredToken()
    throw new Error('Unauthorized: Invalid or expired session')
  }

  return user
}

export function cleanupExpiredSessions(): void {
  const db = getDb()
  const stmt = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')")
  stmt.run()
}
