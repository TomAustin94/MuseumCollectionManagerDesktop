import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    display: 'bg-green-100 text-green-800',
    storage: 'bg-blue-100 text-blue-800',
    loan: 'bg-yellow-100 text-yellow-800',
    conservation: 'bg-orange-100 text-orange-800',
    deaccessioned: 'bg-red-100 text-red-800'
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

export function getConditionColor(condition: string | null): string {
  if (!condition) return 'bg-gray-100 text-gray-600'
  const map: Record<string, string> = {
    excellent: 'bg-green-100 text-green-800',
    good: 'bg-teal-100 text-teal-800',
    fair: 'bg-yellow-100 text-yellow-800',
    poor: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  }
  return map[condition] || 'bg-gray-100 text-gray-600'
}

export function getLocationTypeColor(type: string): string {
  const map: Record<string, string> = {
    gallery: 'bg-purple-100 text-purple-800',
    storage: 'bg-blue-100 text-blue-800',
    conservation: 'bg-orange-100 text-orange-800',
    loan: 'bg-yellow-100 text-yellow-800',
    other: 'bg-gray-100 text-gray-800'
  }
  return map[type] || 'bg-gray-100 text-gray-800'
}

export function truncate(str: string, length: number = 80): string {
  if (str.length <= length) return str
  return str.substring(0, length) + '…'
}

export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
  score: number
} {
  const errors: string[] = []
  let score = 0

  if (password.length >= 12) score++
  else errors.push('At least 12 characters')

  if (/[A-Z]/.test(password)) score++
  else errors.push('One uppercase letter')

  if (/[a-z]/.test(password)) score++
  else errors.push('One lowercase letter')

  if (/[0-9]/.test(password)) score++
  else errors.push('One number')

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++
  else errors.push('One special character')

  return { valid: errors.length === 0, errors, score }
}
