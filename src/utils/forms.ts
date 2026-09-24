import { t } from '@/plugins/i18n'

export interface SelectOption {
  title: string
  value: string
}

export function asText (value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return typeof value === 'number' ? String(value) : ''
}

export function asOption (value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

export function asOptions (value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function isHttpUrl (value: string): boolean {
  try {
    const url = new URL(value)

    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

export const PUBLIC_KEY_PATTERN = /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/

export const ROUTE_PATH_PATTERN = /^\/\S*$/

export const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/

export function asRoleName (value: unknown): string {
  return asText(value).toUpperCase().replaceAll(/\s+/g, '_')
}

export function roleNameError (name: string, taken: readonly string[]): string | null {
  if (!ROLE_NAME_PATTERN.test(name)) {
    return t('forms.roleNamePattern')
  }

  return taken.includes(name) ? t('forms.roleNameTaken') : null
}
