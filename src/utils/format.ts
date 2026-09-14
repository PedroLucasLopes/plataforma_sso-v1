import type { KeyState } from '@/constants/status'

const DATE = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' })

const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function parse (iso: string | null | undefined): Date | null {
  if (!iso) {
    return null
  }

  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? null : date
}

/** Data curta. Valor ausente vira travessao, nao espaco vazio. */
export function formatDate (iso: string | null | undefined): string {
  const date = parse(iso)

  return date ? DATE.format(date) : '—'
}

export function formatDateTime (iso: string | null | undefined): string {
  const date = parse(iso)

  return date ? DATE_TIME.format(date) : '—'
}

/** Primeiro nome, para cumprimento. */
export const firstName = (name: string): string => name.trim().split(/\s+/, 1)[0] ?? name

/** Id longo encurtado para a tela. O valor inteiro continua disponivel para copiar. */
export function shortId (value: string, size = 8): string {
  return value.length > size ? `${value.slice(0, size)}…` : value
}

/** Situacao de uma chave de cliente, derivada das datas. */
export function keyState (key: { revokedAt: string | null, expiresAt: string | null }): KeyState {
  if (key.revokedAt) {
    return 'REVOKED'
  }

  const expires = parse(key.expiresAt)

  return expires && expires.getTime() <= Date.now() ? 'EXPIRED' : 'ACTIVE'
}

/** Plural simples para contagem na interface: "1 route", "3 routes". */
export function plural (count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** Parametro de rota ou query que pode vir repetido. */
export function queryString (value: unknown): string | null {
  return typeof value === 'string' ? value : (Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null)
}
