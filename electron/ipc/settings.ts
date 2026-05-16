import { ipcMain, dialog, app } from 'electron'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { loadSettings, saveSettings, setSetting } from '../settings'
import { requireAuth } from '../auth/session'

function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces()
  const ips: string[] = []
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address)
      }
    }
  }
  return ips
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (event) => {
    await requireAuth(event)
    return loadSettings()
  })

  ipcMain.handle('settings:set-backup-dir', async (event, dir: unknown) => {
    await requireAuth(event)
    const value = dir === null ? null : String(dir)
    setSetting('backupDir', value)
    return { success: true }
  })

  ipcMain.handle('settings:choose-backup-dir', async (event) => {
    await requireAuth(event)
    const result = await dialog.showOpenDialog({
      title: 'Choose Backup Location',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true, path: null }
    }
    const chosen = result.filePaths[0]
    setSetting('backupDir', chosen)
    return { cancelled: false, path: chosen }
  })

  // Network settings — no auth required so they can be read before login
  ipcMain.handle('settings:get-network', () => {
    const s = loadSettings()
    return {
      networkMode: s.networkMode,
      serverPort: s.serverPort,
      serverAddress: s.serverAddress
    }
  })

  ipcMain.handle('settings:set-network', async (event, data: unknown) => {
    await requireAuth(event)
    const { networkMode, serverPort, serverAddress } = data as {
      networkMode?: string
      serverPort?: number
      serverAddress?: string
    }
    const s = loadSettings()
    if (networkMode !== undefined) s.networkMode = networkMode as typeof s.networkMode
    if (serverPort !== undefined) s.serverPort = Number(serverPort)
    if (serverAddress !== undefined) s.serverAddress = String(serverAddress)
    saveSettings(s)
    return { success: true }
  })

  ipcMain.handle('settings:get-local-ips', () => getLocalIps())

  // Backup info — requires auth but visible to all roles
  ipcMain.handle('settings:get-backup-info', async (event) => {
    await requireAuth(event)
    const s = loadSettings()
    const lastBackupFile = path.join(app.getPath('userData'), '.last-backup')
    let lastBackupTime: string | null = null
    try {
      if (fs.existsSync(lastBackupFile)) {
        lastBackupTime = fs.readFileSync(lastBackupFile, 'utf-8').trim()
      }
    } catch {
      // ignore
    }
    return {
      lastBackupTime,
      backupDir: s.backupDir,
      backupScheduleHour: s.backupScheduleHour,
      backupRetention: s.backupRetention
    }
  })

  // Backup schedule — admin only
  ipcMain.handle('settings:set-backup-schedule', async (event, data: unknown) => {
    const user = await requireAuth(event)
    if (user.role !== 'admin') throw new Error('Admin access required')
    const { backupScheduleHour, backupRetention } = data as {
      backupScheduleHour?: number
      backupRetention?: number
    }
    const s = loadSettings()
    if (backupScheduleHour !== undefined) {
      s.backupScheduleHour = Math.min(23, Math.max(0, Math.round(Number(backupScheduleHour))))
    }
    if (backupRetention !== undefined) {
      s.backupRetention = Math.min(30, Math.max(1, Math.round(Number(backupRetention))))
    }
    saveSettings(s)
    return { success: true }
  })

  // Allow setting server address before login (client mode host selection)
  ipcMain.handle('settings:set-server-address', (_event, address: unknown) => {
    const s = loadSettings()
    s.serverAddress = String(address ?? '').trim()
    saveSettings(s)
    return { success: true }
  })
}
