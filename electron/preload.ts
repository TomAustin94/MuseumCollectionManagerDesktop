import { contextBridge, ipcRenderer } from 'electron'

const api = {
  auth: {
    login: (credentials: { username: string; password: string }) =>
      ipcRenderer.invoke('auth:login', credentials),
    verifyMfa: (data: { tempToken: string; totpToken: string }) =>
      ipcRenderer.invoke('auth:verify-mfa', data),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:get-session'),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      ipcRenderer.invoke('auth:change-password', data),
    setupMfa: () => ipcRenderer.invoke('auth:setup-mfa'),
    confirmMfa: (data: { token: string; secret: string }) =>
      ipcRenderer.invoke('auth:confirm-mfa', data),
    disableMfa: (data: { token: string }) => ipcRenderer.invoke('auth:disable-mfa', data)
  },
  items: {
    list: (params?: {
      page?: number
      limit?: number
      status?: string
      categoryId?: number
      locationId?: number
      conditionRating?: string
    }) => ipcRenderer.invoke('items:list', params),
    get: (id: number) => ipcRenderer.invoke('items:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('items:create', data),
    update: (id: number, data: Record<string, unknown>) =>
      ipcRenderer.invoke('items:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('items:delete', id),
    search: (query: string, params?: Record<string, unknown>) =>
      ipcRenderer.invoke('items:search', query, params),
    move: (id: number, data: { locationId?: number; status: string }) =>
      ipcRenderer.invoke('items:move', id, data),
    uploadImage: (itemId: number) => ipcRenderer.invoke('items:upload-image', itemId)
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    get: (id: number) => ipcRenderer.invoke('categories:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('categories:create', data),
    update: (id: number, data: Record<string, unknown>) =>
      ipcRenderer.invoke('categories:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('categories:delete', id)
  },
  locations: {
    list: () => ipcRenderer.invoke('locations:list'),
    get: (id: number) => ipcRenderer.invoke('locations:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('locations:create', data),
    update: (id: number, data: Record<string, unknown>) =>
      ipcRenderer.invoke('locations:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('locations:delete', id)
  },
  reports: {
    overview: () => ipcRenderer.invoke('reports:overview'),
    byLocation: () => ipcRenderer.invoke('reports:by-location'),
    acquisitionTimeline: () => ipcRenderer.invoke('reports:acquisition-timeline'),
    conditionSummary: () => ipcRenderer.invoke('reports:condition-summary')
  },
  export: {
    csv: (filters?: Record<string, unknown>) => ipcRenderer.invoke('export:csv', filters)
  },
  admin: {
    users: {
      list: () => ipcRenderer.invoke('admin:users:list'),
      create: (data: Record<string, unknown>) => ipcRenderer.invoke('admin:users:create', data),
      update: (id: number, data: Record<string, unknown>) =>
        ipcRenderer.invoke('admin:users:update', id, data),
      delete: (id: number) => ipcRenderer.invoke('admin:users:delete', id),
      resetPassword: (id: number, newPassword: string) =>
        ipcRenderer.invoke('admin:users:reset-password', id, newPassword)
    },
    auditLog: {
      list: (params?: { page?: number; limit?: number; tableName?: string; action?: string }) =>
        ipcRenderer.invoke('admin:audit-log:list', params)
    },
    database: {
      backup: () => ipcRenderer.invoke('admin:database:backup'),
      restore: () => ipcRenderer.invoke('admin:database:restore')
    }
  },
  setup: {
    isFirstRun: () => ipcRenderer.invoke('setup:is-first-run'),
    createAdmin: (data: Record<string, unknown>) => ipcRenderer.invoke('setup:create-admin', data)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setBackupDir: (dir: string | null) => ipcRenderer.invoke('settings:set-backup-dir', dir),
    chooseBackupDir: () => ipcRenderer.invoke('settings:choose-backup-dir')
  },
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on('navigate', (_event, path) => callback(path))
  },
  log: {
    info:  (msg: string) => ipcRenderer.send('log:renderer', 'RENDERER', msg),
    error: (msg: string) => ipcRenderer.send('log:renderer', 'RENDERER-ERROR', msg),
    getLogPath: () => ipcRenderer.invoke('log:get-path')
  }
}

contextBridge.exposeInMainWorld('api', api)
