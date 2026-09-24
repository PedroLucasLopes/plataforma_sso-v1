import type { Me } from '@/types/sso'
import { permits } from '@pedrolucaslopes/dotlog-ui'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  API_PREFIX,
  CALLBACK_PATH,
  LOGIN_ATTEMPT_STORAGE_KEY,
  LOGIN_ATTEMPT_TTL_MS,
  LOGIN_PATH,
} from '@/constants/api'
import { ApiError } from '@/services/http'
import { sessionApi } from '@/services/sso'

export type SessionStatus = 'unknown' | 'authenticated' | 'no-access' | 'unauthenticated' | 'unavailable'

export type LoginOutcome
  = | { ok: true, returnTo: string }
    | { ok: false, reason: 'invalid_state' | 'access_denied' | 'failed' }

interface LoginAttempt {
  state: string
  returnTo: string
  createdAt: number
}

function randomState (): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))

  return btoa(String.fromCodePoint(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export function safeReturnPath (path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return '/'
  }

  if ([CALLBACK_PATH, LOGIN_PATH, '/no-access'].some(entry => path.startsWith(entry))) {
    return '/'
  }

  return path
}

function saveAttempt (attempt: LoginAttempt): boolean {
  try {
    sessionStorage.setItem(LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt))

    return true
  } catch {
    return false
  }
}

function takeAttempt (): LoginAttempt | null {
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY)

    sessionStorage.removeItem(LOGIN_ATTEMPT_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<LoginAttempt>

    if (
      typeof parsed.state !== 'string'
      || typeof parsed.returnTo !== 'string'
      || typeof parsed.createdAt !== 'number'
      || Date.now() - parsed.createdAt > LOGIN_ATTEMPT_TTL_MS
    ) {
      return null
    }

    return parsed as LoginAttempt
  } catch {
    return null
  }
}

function accessKey (me: Me | null): string {
  if (!me) {
    return ''
  }

  const routes = me.permissions.map(p => `${p.method} ${p.path}`).toSorted().join(',')

  return `${me.role}|${me.root}|${routes}`
}

export const useSessionStore = defineStore('session', () => {
  const me = ref<Me | null>(null)
  const identity = ref<{ name: string, email: string } | null>(null)
  const csrfToken = ref<string | null>(null)
  const status = ref<SessionStatus>('unknown')
  const signingOut = ref(false)

  let pending: Promise<SessionStatus> | null = null

  const permissions = computed(() => me.value?.permissions ?? [])

  const root = computed(() => me.value?.root === true)

  const can = (method: string, path: string): boolean =>
    permits(permissions.value, method, path, API_PREFIX)

  function reset (): void {
    me.value = null
    identity.value = null
    csrfToken.value = null
  }

  async function load (): Promise<SessionStatus> {
    try {
      const current = await sessionApi.me()

      me.value = current
      identity.value = { name: current.name, email: current.email }
      csrfToken.value = current.csrfToken ?? null
      status.value = 'authenticated'
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        reset()
        status.value = 'unauthenticated'
      } else if (error instanceof ApiError && error.status === 403) {
        const view = await sessionApi.current().catch(() => null)

        me.value = null
        identity.value = view?.user ?? null
        csrfToken.value = view?.csrfToken ?? null
        status.value = 'no-access'
      } else {
        status.value = 'unavailable'
      }
    }

    return status.value
  }

  function ensure (): Promise<SessionStatus> {
    if (status.value !== 'unknown') {
      return Promise.resolve(status.value)
    }

    pending ??= load().finally(() => {
      pending = null
    })

    return pending
  }

  function refresh (): Promise<SessionStatus> {
    status.value = 'unknown'

    return ensure()
  }

  async function revalidate (): Promise<'same' | 'changed' | 'ended' | 'no-access' | 'unknown'> {
    if (status.value !== 'authenticated' || pending) {
      return 'unknown'
    }

    try {
      const current = await sessionApi.me()
      const changed = accessKey(current) !== accessKey(me.value)

      me.value = current
      identity.value = { name: current.name, email: current.email }
      csrfToken.value = current.csrfToken ?? csrfToken.value

      return changed ? 'changed' : 'same'
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        reset()
        status.value = 'unauthenticated'

        return 'ended'
      }

      if (error instanceof ApiError && error.status === 403) {
        const view = await sessionApi.current().catch(() => null)

        me.value = null
        identity.value = view?.user ?? identity.value
        csrfToken.value = view?.csrfToken ?? csrfToken.value
        status.value = 'no-access'

        return 'no-access'
      }

      return 'unknown'
    }
  }

  function beginLogin (returnTo: string): void {
    const state = randomState()

    saveAttempt({ state, returnTo: safeReturnPath(returnTo), createdAt: Date.now() })

    window.location.assign(sessionApi.loginUrl(`${window.location.origin}${CALLBACK_PATH}`, state))
  }

  function completeLogin (query: { state?: string | null, error?: string | null }): LoginOutcome {
    const attempt = takeAttempt()

    if (!attempt || !query.state || attempt.state !== query.state) {
      return { ok: false, reason: 'invalid_state' }
    }

    if (query.error === 'access_denied') {
      return { ok: false, reason: 'access_denied' }
    }

    if (query.error) {
      return { ok: false, reason: 'failed' }
    }

    status.value = 'unknown'

    return { ok: true, returnTo: attempt.returnTo }
  }

  async function signOut (): Promise<void> {
    signingOut.value = true

    await sessionApi.logout().catch(() => null)

    signingOut.value = false

    reset()
    status.value = 'unauthenticated'
    beginLogin('/')
  }

  function handleUnauthorized (): void {
    if (status.value === 'unauthenticated') {
      return
    }

    reset()
    status.value = 'unauthenticated'
    beginLogin(`${window.location.pathname}${window.location.search}`)
  }

  return {
    me,
    identity,
    csrfToken,
    status,
    signingOut,
    permissions,
    root,
    can,
    ensure,
    refresh,
    revalidate,
    beginLogin,
    completeLogin,
    signOut,
    handleUnauthorized,
  }
})
