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
