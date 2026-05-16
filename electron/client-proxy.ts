import { ipcMain } from 'electron'
import { storeSessionToken, clearStoredToken, getStoredToken } from './auth/session'
import { loadSettings } from './settings'

function getBaseUrl(): string {
  const { serverAddress } = loadSettings()
  if (!serverAddress) {
    throw new Error(
      'Server address not configured. Go to Settings → Network to enter the server address.'
    )
  }
  return `http://${serverAddress}`
}

async function rpcCall(channel: string, args: unknown[]): Promise<unknown> {
  const token = await getStoredToken()
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ channel, args })
  })
  const data = (await res.json()) as { error?: string }
  if (!res.ok) throw new Error(data.error || `RPC call failed (${channel})`)
  return data
}

export function registerClientProxyHandlers(): void {
  // ── Setup ──────────────────────────────────────────────────────────────
  ipcMain.handle('setup:is-first-run', async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/setup/is-first-run`)
      return res.json()
    } catch {
      return false
    }
  })

  ipcMain.handle('setup:create-admin', async (_event, data) => {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/setup/create-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = (await res.json()) as { error?: string }
    if (!res.ok) throw new Error(result.error || 'Failed to create admin')
    return result
  })

  // ── Auth ───────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async (_event, credentials) => {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })
    const result = (await res.json()) as {
      requiresMfa: boolean
      tempToken?: string
      sessionToken?: string
      user?: unknown
      error?: string
    }
    if (!res.ok) throw new Error(result.error || 'Login failed')
    if (result.sessionToken) await storeSessionToken(result.sessionToken)
    return { requiresMfa: result.requiresMfa, tempToken: result.tempToken, user: result.user }
  })

  ipcMain.handle('auth:verify-mfa', async (_event, data) => {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/api/auth/mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result = (await res.json()) as { sessionToken?: string; user?: unknown; error?: string }
    if (!res.ok) throw new Error(result.error || 'MFA verification failed')
    if (result.sessionToken) await storeSessionToken(result.sessionToken)
    return { user: result.user }
  })

  ipcMain.handle('auth:logout', async () => {
    const token = await getStoredToken()
    if (token) {
      try {
        await fetch(`${getBaseUrl()}/api/auth/session`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch {
        // ignore network errors on logout
      }
      await clearStoredToken()
    }
    return { success: true }
  })

  ipcMain.handle('auth:get-session', async () => {
    const token = await getStoredToken()
    if (!token) return null
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/session`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        await clearStoredToken()
        return null
      }
      return res.json()
    } catch {
      return null
    }
  })

  // ── Generic RPC proxied channels ───────────────────────────────────────
  const proxiedChannels = [
    'auth:change-password',
    'auth:setup-mfa',
    'auth:confirm-mfa',
    'auth:disable-mfa',
    'items:list',
    'items:get',
    'items:create',
    'items:update',
    'items:delete',
    'items:search',
    'items:move',
    'categories:list',
    'categories:get',
    'categories:create',
    'categories:update',
    'categories:delete',
    'locations:list',
    'locations:get',
    'locations:create',
    'locations:update',
    'locations:delete',
    'reports:overview',
    'reports:by-location',
    'reports:acquisition-timeline',
    'reports:condition-summary',
    'admin:users:list',
    'admin:users:create',
    'admin:users:update',
    'admin:users:delete',
    'admin:users:reset-password',
    'admin:audit-log:list',
    'admin:demo:import',
    'admin:demo:clear'
  ]

  for (const channel of proxiedChannels) {
    ipcMain.handle(channel, (_event, ...args) => rpcCall(channel, args))
  }

  // ── Local-only / disabled operations ───────────────────────────────────
  ipcMain.handle('items:upload-image', async () => {
    throw new Error('Image upload is not available in client mode. Use the server PC to upload images.')
  })

  ipcMain.handle('admin:database:backup', async () => {
    throw new Error('Database backup must be performed on the server PC.')
  })

  ipcMain.handle('admin:database:restore', async () => {
    throw new Error('Database restore must be performed on the server PC.')
  })

  ipcMain.handle('export:csv', async () => {
    throw new Error('CSV export is not available in client mode. Use the server PC to export.')
  })
}
