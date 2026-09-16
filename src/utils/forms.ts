import { t } from '@/plugins/i18n'

/** Opcao de seletor no formato que `DlSelect` le por padrao. */
export interface SelectOption {
  title: string
  value: string
}

/** Valor de campo de texto como string. O campo pode devolver numero ou `null`. */
export function asText (value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return typeof value === 'number' ? String(value) : ''
}

/** Valor unico de seletor. Limpar o campo devolve `null`. */
export function asOption (value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** Valores de seletor multiplo. */
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

/** O mesmo formato que o SSO exige em `POST /clientkey`. */
export const PUBLIC_KEY_PATTERN = /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/

/** Caminho de rota do catalogo: comeca com barra e nao tem espaco. */
export const ROUTE_PATH_PATTERN = /^\/\S*$/

/** O mesmo formato que o SSO exige em nome de papel: ARQUITETO, GESTOR_FINANCEIRO. */
export const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/

/** Nome de papel como a pessoa digita, ja no formato do SSO: maiusculas, e espaco vira `_`. */
export function asRoleName (value: unknown): string {
  return asText(value).toUpperCase().replaceAll(/\s+/g, '_')
}

/** Por que o nome de papel nao serve, ou `null`. `taken` sao os nomes que o projeto ja tem. */
export function roleNameError (name: string, taken: readonly string[]): string | null {
  if (!ROLE_NAME_PATTERN.test(name)) {
    return t('forms.roleNamePattern')
  }

  return taken.includes(name) ? t('forms.roleNameTaken') : null
}
