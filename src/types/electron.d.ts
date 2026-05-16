export interface User {
  id: number
  username: string
  email: string
  fullName: string | null
  role: 'admin' | 'editor' | 'viewer'
  totpEnabled: boolean
}

export interface Item {
  id: number
  accession_number: string
  title: string
  description: string | null
  category_id: number | null
  location_id: number | null
  category_name: string | null
  location_name: string | null
  status: 'storage' | 'display' | 'loan' | 'conservation' | 'deaccessioned'
  acquisition_date: string | null
  acquisition_method: string | null
  donor_name: string | null
  estimated_value: number | null
  condition_rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | null
  provenance: string | null
  notes: string | null
  imagePaths: string[]
  tags: string[]
  created_by: number | null
  updated_by: number | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  parent_id: number | null
  parent_name: string | null
  item_count: number
  created_at: string
}

export interface Location {
  id: number
  name: string
  type: 'gallery' | 'storage' | 'conservation' | 'loan' | 'other'
  description: string | null
  item_count: number
  created_at: string
}

export interface AuditLogEntry {
  id: number
  table_name: string
  record_id: number
  action: string
  old_data: string | null
  new_data: string | null
  changed_by: number | null
  username: string | null
  changed_at: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

declare global {
  interface Window {
    api: {
      auth: {
        login: (credentials: {
          username: string
          password: string
        }) => Promise<
          | { requiresMfa: true; tempToken: string }
          | { requiresMfa: false; user: User }
        >
        verifyMfa: (data: {
          tempToken: string
          totpToken: string
        }) => Promise<{ user: User }>
        logout: () => Promise<{ success: boolean }>
        getSession: () => Promise<User | null>
        changePassword: (data: {
          currentPassword: string
          newPassword: string
        }) => Promise<{ success: boolean }>
        setupMfa: () => Promise<{
          secret: string
          qrCodeDataUrl: string
          encryptedSecret: string
        }>
        confirmMfa: (data: {
          token: string
          secret: string
        }) => Promise<{ success: boolean; recoveryCodes: string[] }>
        disableMfa: (data: { token: string }) => Promise<{ success: boolean }>
      }
      items: {
        list: (params?: {
          page?: number
          limit?: number
          status?: string
          categoryId?: number
          locationId?: number
          conditionRating?: string
        }) => Promise<PaginatedResult<Item>>
        get: (id: number) => Promise<Item>
        create: (data: Record<string, unknown>) => Promise<{ id: number }>
        update: (id: number, data: Record<string, unknown>) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
        search: (
          query: string,
          params?: { page?: number; limit?: number }
        ) => Promise<PaginatedResult<Item>>
        move: (
          id: number,
          data: { locationId?: number | null; status: string }
        ) => Promise<{ success: boolean }>
        uploadImage: (itemId: number) => Promise<{ success: boolean; imagePaths: string[] }>
      }
      categories: {
        list: () => Promise<Category[]>
        get: (id: number) => Promise<Category>
        create: (data: Record<string, unknown>) => Promise<{ id: number }>
        update: (id: number, data: Record<string, unknown>) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      locations: {
        list: () => Promise<Location[]>
        get: (id: number) => Promise<Location>
        create: (data: Record<string, unknown>) => Promise<{ id: number }>
        update: (id: number, data: Record<string, unknown>) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      reports: {
        overview: () => Promise<{
          totalItems: number
          totalValue: number
          byStatus: Array<{ status: string; count: number }>
          byCondition: Array<{ condition_rating: string; count: number }>
          recentItems: Item[]
          recentActivity: AuditLogEntry[]
        }>
        byLocation: () => Promise<{
          byLocation: Array<{
            id: number
            name: string
            type: string
            item_count: number
            total_value: number | null
          }>
          unlocated: number
        }>
        acquisitionTimeline: () => Promise<{
          byYear: Array<{ year: string; count: number; total_value: number | null }>
          byMonth: Array<{ month: string; count: number; total_value: number | null }>
          byMethod: Array<{ method: string; count: number }>
        }>
        conditionSummary: () => Promise<{
          conditionBreakdown: Array<{
            condition_rating: string
            count: number
            total_value: number | null
          }>
          byCategory: Array<{
            category_name: string
            condition_rating: string
            count: number
          }>
          itemsNeedingAttention: Item[]
        }>
      }
      export: {
        csv: (filters?: Record<string, unknown>) => Promise<{
          success: boolean
          filePath?: string
          count?: number
          reason?: string
        }>
      }
      admin: {
        users: {
          list: () => Promise<User[]>
          create: (data: Record<string, unknown>) => Promise<{ id: number }>
          update: (id: number, data: Record<string, unknown>) => Promise<{ success: boolean }>
          delete: (id: number) => Promise<{ success: boolean }>
          resetPassword: (id: number, newPassword: string) => Promise<{ success: boolean }>
        }
        auditLog: {
          list: (params?: {
            page?: number
            limit?: number
            tableName?: string
            action?: string
          }) => Promise<{
            entries: AuditLogEntry[]
            total: number
            page: number
            limit: number
            totalPages: number
          }>
        }
        database: {
          backup: () => Promise<{ success: boolean; filePath?: string; reason?: string }>
          restore: () => Promise<{ success: boolean; reason?: string }>
        }
        demo: {
          import: () => Promise<{ success: boolean; categories: number; locations: number; items: number }>
          clear: () => Promise<{ success: boolean; items: number }>
        }
      }
      setup: {
        isFirstRun: () => Promise<boolean>
        createAdmin: (data: Record<string, unknown>) => Promise<{ success: boolean; userId: number }>
      }
      settings: {
        get: () => Promise<{ backupDir: string | null }>
        setBackupDir: (dir: string | null) => Promise<{ success: boolean }>
        chooseBackupDir: () => Promise<{ cancelled: boolean; path: string | null }>
      }
      onNavigate: (callback: (path: string) => void) => void
      updater: {
        check: () => Promise<void>
        install: () => void
        onStatus: (callback: (payload: { status: string; version?: string; percent?: number; error?: string }) => void) => void
      }
      log: {
        info: (msg: string) => void
        error: (msg: string) => void
        getLogPath: () => Promise<string>
      }
    }
  }
}
