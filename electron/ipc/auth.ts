import { ipcMain } from 'electron'
import { z } from 'zod'
import { getDb } from '../db/client'
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/password'
import {
  createSession,
  validateSession,
  destroySession,
  storeSessionToken,
  getStoredToken,
  clearStoredToken,
  requireAuth
} from '../auth/session'
import {
  generateSecret,
  generateQrCode,
  verifyToken,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  storeRecoveryCodes
} from '../auth/totp'

const LOCKOUT_DURATION_MINUTES = 15
const MAX_FAILED_ATTEMPTS = 5

// Temporary tokens for MFA flow (in-memory, keyed by tempToken)
const pendingMfaTokens = new Map<string, { userId: number; expiresAt: number }>()

const LoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200)
})

const VerifyMfaSchema = z.object({
  tempToken: z.string().min(1),
  totpToken: z.string().min(6).max(8)
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12)
})

const ConfirmMfaSchema = z.object({
  token: z.string().min(6).max(8),
  secret: z.string().min(1)
})

const DisableMfaSchema = z.object({
  token: z.string().min(6).max(8)
})

export function registerAuthHandlers(): void {
  // Check first run
  ipcMain.handle('setup:is-first-run', () => {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    return row.count === 0
  })

  // Create admin on first run
  ipcMain.handle('setup:create-admin', async (_event, data: unknown) => {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    if (row.count > 0) {
      throw new Error('Admin account already exists')
    }

    const parsed = z.object({
      username: z.string().min(3).max(50),
      email: z.string().email(),
      password: z.string().min(12),
      fullName: z.string().optional()
    }).parse(data)

    const validation = validatePasswordStrength(parsed.password)
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    const passwordHash = hashPassword(parsed.password)
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, 'admin')
    `)
    const result = stmt.run(parsed.username, parsed.email, passwordHash, parsed.fullName || null)
    return { success: true, userId: result.lastInsertRowid }
  })

  // Login
  ipcMain.handle('auth:login', async (_event, data: unknown) => {
    const parsed = LoginSchema.parse(data)
    const db = getDb()

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(parsed.username) as {
      id: number
      username: string
      email: string
      password_hash: string
      full_name: string | null
      role: string
      totp_secret: string | null
      totp_enabled: number
      failed_attempts: number
      locked_until: string | null
    } | undefined

    if (!user) {
      throw new Error('Invalid username or password')
    }

    // Check lockout
    if (user.locked_until) {
      const lockoutTime = new Date(user.locked_until)
      if (lockoutTime > new Date()) {
        const minutesLeft = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000)
        throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`)
      } else {
        // Unlock account
        db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id)
      }
    }

    const passwordValid = verifyPassword(parsed.password, user.password_hash)

    if (!passwordValid) {
      const newFailedAttempts = user.failed_attempts + 1
      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString()
        db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
          newFailedAttempts,
          lockedUntil,
          user.id
        )
        throw new Error(`Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`)
      } else {
        db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(newFailedAttempts, user.id)
        const attemptsLeft = MAX_FAILED_ATTEMPTS - newFailedAttempts
        throw new Error(`Invalid username or password. ${attemptsLeft} attempt(s) remaining.`)
      }
    }

    // Reset failed attempts on success
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id)

    // Check if MFA is required
    if (user.totp_enabled) {
      // Generate a temporary token for MFA verification
      const { v4: uuidv4 } = await import('uuid')
      const tempToken = uuidv4()
      pendingMfaTokens.set(tempToken, {
        userId: user.id,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      })

      return {
        requiresMfa: true,
        tempToken
      }
    }

    const token = createSession(user.id)
    await storeSessionToken(token)

    return {
      requiresMfa: false,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        totpEnabled: user.totp_enabled === 1
      }
    }
  })

  // Verify MFA
  ipcMain.handle('auth:verify-mfa', async (_event, data: unknown) => {
    const parsed = VerifyMfaSchema.parse(data)
    const db = getDb()

    const pending = pendingMfaTokens.get(parsed.tempToken)
    if (!pending || pending.expiresAt < Date.now()) {
      pendingMfaTokens.delete(parsed.tempToken)
      throw new Error('MFA session expired. Please log in again.')
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pending.userId) as {
      id: number
      username: string
      email: string
      full_name: string | null
      role: string
      totp_secret: string | null
      totp_enabled: number
    } | undefined

    if (!user || !user.totp_secret) {
      throw new Error('User not found or MFA not configured')
    }

    const secret = decryptSecret(user.totp_secret)
    const isValid = verifyToken(secret, parsed.totpToken)

    if (!isValid) {
      throw new Error('Invalid MFA code')
    }

    pendingMfaTokens.delete(parsed.tempToken)

    const token = createSession(user.id)
    await storeSessionToken(token)

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        totpEnabled: user.totp_enabled === 1
      }
    }
  })

  // Logout
  ipcMain.handle('auth:logout', async () => {
    const token = await getStoredToken()
    if (token) {
      destroySession(token)
      await clearStoredToken()
    }
    return { success: true }
  })

  // Get session
  ipcMain.handle('auth:get-session', async () => {
    const token = await getStoredToken()
    if (!token) return null

    const user = validateSession(token)
    if (!user) {
      await clearStoredToken()
      return null
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      totpEnabled: user.totp_enabled === 1
    }
  })

  // Change password
  ipcMain.handle('auth:change-password', async (event, data: unknown) => {
    const currentUser = await requireAuth(event)
    const parsed = ChangePasswordSchema.parse(data)

    const db = getDb()
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(currentUser.id) as
      | { password_hash: string }
      | undefined

    if (!user) throw new Error('User not found')

    if (!verifyPassword(parsed.currentPassword, user.password_hash)) {
      throw new Error('Current password is incorrect')
    }

    const validation = validatePasswordStrength(parsed.newPassword)
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    const newHash = hashPassword(parsed.newPassword)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, currentUser.id)

    return { success: true }
  })

  // Setup MFA
  ipcMain.handle('auth:setup-mfa', async (event) => {
    const user = await requireAuth(event)
    const setup = generateSecret(user.username)
    const qrCodeDataUrl = await generateQrCode(setup.qrCodeDataUrl)

    return {
      secret: setup.secret,
      qrCodeDataUrl,
      encryptedSecret: setup.encryptedSecret
    }
  })

  // Confirm MFA setup
  ipcMain.handle('auth:confirm-mfa', async (event, data: unknown) => {
    const currentUser = await requireAuth(event)
    const parsed = ConfirmMfaSchema.parse(data)

    const isValid = verifyToken(parsed.secret, parsed.token)
    if (!isValid) {
      throw new Error('Invalid TOTP token. Please try again.')
    }

    const encryptedSecret = encryptSecret(parsed.secret)
    const db = getDb()
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?').run(
      encryptedSecret,
      currentUser.id
    )

    const recoveryCodes = generateRecoveryCodes()
    storeRecoveryCodes(currentUser.id, recoveryCodes)

    return { success: true, recoveryCodes }
  })

  // Disable MFA
  ipcMain.handle('auth:disable-mfa', async (event, data: unknown) => {
    const currentUser = await requireAuth(event)
    const parsed = DisableMfaSchema.parse(data)

    const db = getDb()
    const user = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(currentUser.id) as
      | { totp_secret: string | null }
      | undefined

    if (!user?.totp_secret) {
      throw new Error('MFA is not enabled')
    }

    const secret = decryptSecret(user.totp_secret)
    const isValid = verifyToken(secret, parsed.token)

    if (!isValid) {
      throw new Error('Invalid TOTP token')
    }

    db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(
      currentUser.id
    )
    db.prepare('DELETE FROM totp_recovery_codes WHERE user_id = ?').run(currentUser.id)

    return { success: true }
  })
}
