import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface AppSettings {
  backupDir: string | null
  networkMode: 'standalone' | 'server' | 'client'
  serverPort: number
  serverAddress: string
  backupScheduleHour: number
  backupRetention: number
}

const defaults: AppSettings = {
  backupDir: null,
  networkMode: 'standalone',
  serverPort: 4567,
  serverAddress: '',
  backupScheduleHour: 2,
  backupRetention: 7
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return loadSettings()[key]
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  const current = loadSettings()
  saveSettings({ ...current, [key]: value })
}
