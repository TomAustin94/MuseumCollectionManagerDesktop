import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { safeStorage } from 'electron'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/client'

const APP_NAME = 'Museum Collection Manager'

export interface TotpSetup {
  secret: string
  qrCodeDataUrl: string
  encryptedSecret: string
}

export function generateSecret(username: string): TotpSetup {
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME}:${username}`,
    issuer: APP_NAME,
    length: 32
  })

  const otpauthUrl = secret.otpauth_url || ''
  const encryptedSecret = encryptSecret(secret.base32)

  return {
    secret: secret.base32,
    qrCodeDataUrl: otpauthUrl,
    encryptedSecret
  }
}

export async function generateQrCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl)
}

export function verifyToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1
  })
}

export function encryptSecret(secret: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(secret)
    return encrypted.toString('base64')
  }
  // Fallback: store as base64 if encryption unavailable
  return Buffer.from(secret).toString('base64')
}

export function decryptSecret(encryptedSecret: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(encryptedSecret, 'base64')
    return safeStorage.decryptString(buffer)
  }
  // Fallback: decode from base64
  return Buffer.from(encryptedSecret, 'base64').toString('utf-8')
}

export function generateRecoveryCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase() +
                 '-' +
                 Math.random().toString(36).substring(2, 7).toUpperCase()
    codes.push(code)
  }
  return codes
}

export function storeRecoveryCodes(userId: number, codes: string[]): void {
  const db = getDb()

  // Delete existing codes
  const deleteStmt = db.prepare('DELETE FROM totp_recovery_codes WHERE user_id = ?')
  deleteStmt.run(userId)

  // Insert new hashed codes
  const insertStmt = db.prepare(
    'INSERT INTO totp_recovery_codes (user_id, code_hash) VALUES (?, ?)'
  )

  for (const code of codes) {
    const hash = bcrypt.hashSync(code, 10)
    insertStmt.run(userId, hash)
  }
}

export function verifyRecoveryCode(userId: number, code: string): boolean {
  const db = getDb()

  const stmt = db.prepare(
    'SELECT id, code_hash FROM totp_recovery_codes WHERE user_id = ? AND used = 0'
  )
  const codes = stmt.all(userId) as Array<{ id: number; code_hash: string }>

  for (const row of codes) {
    if (bcrypt.compareSync(code, row.code_hash)) {
      // Mark as used
      const markUsed = db.prepare('UPDATE totp_recovery_codes SET used = 1 WHERE id = ?')
      markUsed.run(row.id)
      return true
    }
  }

  return false
}
