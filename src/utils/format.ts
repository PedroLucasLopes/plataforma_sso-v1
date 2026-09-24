import type { KeyState } from '@/constants/status'
import { currentLocale } from '@/plugins/i18n'

const DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }

const DATE_TIME: Intl.DateTimeFormatOptions = { ...DATE, hour: '2-digit', minute: '2-digit' }

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter (name: 'date' | 'dateTime'): Intl.DateTimeFormat {
  const locale = currentLocale()
  const key = `${name}:${locale}`
  let format = formatters.get(key)

  if (!format) {
    format = new Intl.DateTimeFormat(locale, name === 'date' ? DATE : DATE_TIME)
    formatters.set(key, format)
  }

  return format
}

function parse (iso: string | null | undefined): Date | null {
  if (!iso) {
    return null
  }

  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate (iso: string | null | undefined): string {
  const date = parse(iso)

  return date ? formatter('date').format(date) : '—'
}

export function formatDateTime (iso: string | null | undefined): string {
  const date = parse(iso)

  return date ? formatter('dateTime').format(date) : '—'
}

export const firstName = (name: string): string => name.trim().split(/\s+/, 1)[0] ?? name

export function shortId (value: string, size = 8): string {
  return value.length > size ? `${value.slice(0, size)}…` : value
}

export function keyState (key: { revokedAt: string | null, expiresAt: string | null }): KeyState {
  if (key.revokedAt) {
    return 'REVOKED'
  }

  const expires = parse(key.expiresAt)

  return expires && expires.getTime() <= Date.now() ? 'EXPIRED' : 'ACTIVE'
}

export function queryString (value: unknown): string | null {
  return typeof value === 'string' ? value : (Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null)
}
