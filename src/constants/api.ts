/**
 * Prefixo global do SSO. O console fala com ele na mesma origem: proxy do
 * Vite em desenvolvimento, rewrite do hosting em producao.
 */
export const API_PREFIX = '/sso'

/**
 * Rota do console que recebe a volta do login. `${origin}/callback` precisa
 * estar registrada como redirect_uri do projeto SSO, por igualdade exata.
 */
export const CALLBACK_PATH = '/callback'

/** Tela de login do IdP. So oferece login com um pedido pendente. */
export const LOGIN_PATH = '/login'

/** Onde o console guarda o `state` do login em curso. Some junto com a aba. */
export const LOGIN_ATTEMPT_STORAGE_KEY = 'sso.console.login'

/** Vida do `state` guardado. Maior que o pedido no SSO, que dura cinco minutos. */
export const LOGIN_ATTEMPT_TTL_MS = 10 * 60 * 1000

/**
 * O projeto que representa o proprio SSO. Mantenha igual a
 * `SSO_SELF_PROJECT_NAME` no SSO. O servidor recusa apagar, renomear, suspender
 * e mexer no catalogo dele; a tela so deixa de oferecer o caminho fechado.
 */
export const SELF_PROJECT_NAME = 'SSO'
