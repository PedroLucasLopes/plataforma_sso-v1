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

/**
 * - `authenticated`: sessao valida e papel no console.
 * - `no-access`: sessao valida, sem papel no projeto SSO.
 * - `unauthenticated`: sem sessao; o console manda ao login.
 * - `unavailable`: o SSO nao respondeu, e nao da para afirmar nada.
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'no-access' | 'unauthenticated' | 'unavailable'

export type LoginOutcome
  = | { ok: true, returnTo: string }
    | { ok: false, reason: 'invalid_state' | 'access_denied' | 'failed' }

interface LoginAttempt {
  state: string
  returnTo: string
  createdAt: number
}

/** 24 bytes em base64url: 32 caracteres do conjunto unreserved, como o SSO exige. */
function randomState (): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))

  return btoa(String.fromCodePoint(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

/**
 * Destino da volta do login. So caminho interno: `//host` e `/\host` o
 * navegador leria como outro site, e isto viraria um redirect aberto.
 */
export function safeReturnPath (path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return '/'
  }

  // Voltar para a propria tela de entrada so recomecaria o ciclo.
  if ([CALLBACK_PATH, LOGIN_PATH, '/no-access'].some(entry => path.startsWith(entry))) {
    return '/'
  }

  return path
}

function saveAttempt (attempt: LoginAttempt): void {
  try {
    sessionStorage.setItem(LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt))
  } catch {
    /* Sem armazenamento a volta falha na conferencia do state, que e o lado certo de errar. */
  }
}

/** Le e apaga: o state vale para uma volta so. */
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

/** O que o papel alcanca, numa string comparavel: papel, raiz e rotas em ordem. */
function accessKey (me: Me | null): string {
  if (!me) {
    return ''
  }

  const rotas = me.permissions.map(p => `${p.method} ${p.path}`).toSorted().join(',')

  return `${me.role}|${me.root}|${rotas}`
}

/**
 * A sessao do console.
 *
 * O console se autentica pela sessao do proprio SSO, na mesma origem da API
 * (RFC 10017 secao 7.1). Nenhum token de acesso passa por aqui: o que o store
 * guarda e quem entrou, o que o papel alcanca e a copia legivel do token
 * anti-CSRF, que so vale junto do cookie HttpOnly.
 *
 * Para entrar, o console faz o que qualquer aplicacao faz: manda a pessoa ao
 * SSO com a `redirect_uri` registrada e um `state` dele, e confere o `state`
 * na volta. A tela de login do IdP nunca abre sem esse pedido.
 */
export const useSessionStore = defineStore('session', () => {
  const me = ref<Me | null>(null)
  const identity = ref<{ name: string, email: string } | null>(null)
  const csrfToken = ref<string | null>(null)
  const status = ref<SessionStatus>('unknown')
  const signingOut = ref(false)

  let pending: Promise<SessionStatus> | null = null

  const permissions = computed(() => me.value?.permissions ?? [])

  /**
   * SUPERADMIN do projeto `SSO`. O servidor manda para ela, em `permissions`,
   * toda rota administrativa que existe, entao `can` ja responde que sim; `root`
   * serve ao que so ela pode dentro do proprio SSO.
   */
  const root = computed(() => me.value?.root === true)

  /** Mesma pergunta do servidor, com o mesmo matcher. So controla interface. */
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
        // Sessao valida, sem papel no console. O token anti-CSRF vem da sessao,
        // senao a pessoa nem conseguiria sair para entrar com outra conta.
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

  /** Carrega uma vez; chamadas simultaneas esperam a mesma resposta. */
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

  /**
   * Rele quem e a pessoa e o que o papel dela alcanca, sem tirar a tela do lugar.
   *
   * O SSO rele o papel a cada chamada, entao a API ja vale na hora; o que ficava
   * para tras era a tela, carregada uma vez. `me` so e trocado quando a resposta
   * chega, e o SSO fora do ar nao derruba ninguem: a tela fica como esta.
   */
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
        // Tirada do projeto SSO: a sessao continua, o console nao.
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

  /** Navegacao de pagina ao SSO. Quem chama nao deve continuar a navegacao. */
  function beginLogin (returnTo: string): void {
    const state = randomState()

    saveAttempt({ state, returnTo: safeReturnPath(returnTo), createdAt: Date.now() })

    window.location.assign(sessionApi.loginUrl(`${window.location.origin}${CALLBACK_PATH}`, state))
  }

  /** Confere a volta do SSO. So o `state` que este navegador gerou e aceito. */
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

  /**
   * Encerra a sessao no SSO, que derruba tambem os refresh tokens de todos os
   * projetos, e volta ao login. Sem sessao, o SSO pede login de novo.
   */
  async function signOut (): Promise<void> {
    signingOut.value = true

    try {
      await sessionApi.logout()
    } catch {
      /* Sessao que ja caiu nao tem o que encerrar. */
    } finally {
      signingOut.value = false
    }

    reset()
    status.value = 'unauthenticated'
    beginLogin('/')
  }

  /** Sessao que cai no meio do uso. A pessoa volta para a tela onde estava. */
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
