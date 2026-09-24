import { API_PREFIX } from '@/constants/api'
import { apiErrorText, STATUS_MESSAGE_KEYS } from '@/constants/messages'
import { t } from '@/plugins/i18n'

export class ApiError extends Error {
  constructor (
    readonly status: number,
    message: string,
    readonly code: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: object
  emptyOn404?: boolean
  redirectOnUnauthorized?: boolean
  signal?: AbortSignal
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let readCsrfToken: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function configureHttp (options: {
  csrfToken: () => string | null
  unauthorized: () => void
}): void {
  readCsrfToken = options.csrfToken
  onUnauthorized = options.unauthorized
}

function buildUrl (path: string, query?: object): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    const primitive = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

    if (primitive && value !== '') {
      params.set(key, String(value))
    }
  }

  const search = params.toString()

  return `${API_PREFIX}${path}${search ? `?${search}` : ''}`
}

async function readBody (response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function describe (status: number, payload: unknown): { message: string, code: string | null } {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const code = typeof body.error === 'string' ? body.error : null
  const known = apiErrorText(code, body)

  if (known) {
    return { message: known, code }
  }

  const byStatus = STATUS_MESSAGE_KEYS[status] ?? (status >= 500 ? STATUS_MESSAGE_KEYS[500] : undefined)

  return { message: byStatus ? t(byStatus) : t('errors.fallback'), code }
}

export async function request<T> (path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (!SAFE_METHODS.has(method)) {
    const token = readCsrfToken()

    if (token) {
      headers['X-CSRF-Token'] = token
    }
  }

  let response: Response

  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new ApiError(0, t('errors.status.network'), 'network_error')
  }

  if (response.status === 404 && options.emptyOn404) {
    return [] as T
  }

  if (response.status === 401) {
    if (options.redirectOnUnauthorized !== false) {
      onUnauthorized()
    }

    throw new ApiError(401, t('errors.status.unauthorized'), 'unauthorized')
  }

  const payload = response.status === 204 ? null : await readBody(response)

  if (!response.ok) {
    const { message, code } = describe(response.status, payload)

    throw new ApiError(response.status, message, code)
  }

  return payload as T
}

export function errorMessage (error: unknown): string {
  return error instanceof ApiError ? error.message : t('errors.fallback')
}
