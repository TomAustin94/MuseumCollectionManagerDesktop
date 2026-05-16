import { ipcMain, dialog } from 'electron'
import os from 'os'
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
}
