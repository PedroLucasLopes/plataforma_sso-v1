import type { SignInError } from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'

/**
 * Os codigos que o console conhece, e onde mora o texto de cada um. O texto em
 * si mora nos arquivos de traducao, em `src/locales`.
 */

/**
 * Codigos que o SSO manda para a tela de login.
 *
 * So codigo conhecido vira mensagem. Texto livre lido da URL nunca aparece na
 * tela de login: e a pagina de maior confianca do ecossistema, e seria um mural
 * para quem quisesse enganar alguem. Codigo fora da lista vira a mensagem
 * generica.
 */
const LOGIN_ERROR_CODES = new Set([
  'no_pending_request',
  'request_expired',
  'account_not_registered',
  'email_not_verified',
  'account_mismatch',
  'provider_denied',
  'provider_error',
])

export function loginError (code: string): SignInError {
  const key = LOGIN_ERROR_CODES.has(code) ? `login.errors.${code}` : 'login.generic'

  return { title: t(`${key}.title`), description: t(`${key}.description`) }
}

/** Icone de cada provedor. O SSO manda o id; o desenho e do front. */
export const PROVIDER_ICONS: Record<string, string> = {
  google: 'mdi-google',
}

/**
 * Mensagens do backend escritas para quem opera a API, traduzidas para quem
 * usa o console. A chave e o texto exato que o servidor devolve; o valor, a
 * chave de traducao. `Map`, e nao objeto: o texto vem do servidor, e
 * `constructor` nao pode achar nada.
 */
export const API_MESSAGE_KEYS = new Map<string, string>([
  ['cadastre ao menos uma chave publica em /clientkey antes de ativar', 'errors.api.keyRequiredToActivate'],
  ['This project have ongoing permissions', 'errors.api.projectHasMembers'],
  ['Some routes are associated with this project', 'errors.api.projectHasRoutes'],
  ['This user have ongoing permissions', 'errors.api.userHasProjects'],
  ['You cannot associate roles from different projects', 'errors.api.roleAndRouteProjects'],
  ['publicKeyPem deve ser uma chave publica em PEM (SPKI)', 'errors.api.publicKeyNotPem'],
  ['publicKeyPem nao e uma chave valida', 'errors.api.publicKeyInvalid'],
  ['apenas chaves RSA sao aceitas (RS256)', 'errors.api.publicKeyNotRsa'],
  ['a chave RSA precisa ter ao menos 2048 bits', 'errors.api.publicKeyTooShort'],
  ['Chave nao encontrada ou ja revogada', 'errors.api.keyNotFound'],
  ['Nenhuma chave cadastrada para este projeto', 'errors.api.noKeys'],
])

/** Codigos de erro nomeados que o backend manda, com texto em `errors.code`. */
export const ERROR_CODES = new Set([
  'csrf_token_invalid',
  'origin_not_allowed',
  'sso_project_protected',
  'sso_last_superadmin',
  'sso_redirect_uri_last',
  'sso_redirect_uri_in_use',
])

/** Ultimo recurso, por status HTTP. `0` e o SSO que nao respondeu. */
export const STATUS_MESSAGE_KEYS: Readonly<Record<number, string>> = {
  0: 'errors.status.network',
  401: 'errors.status.unauthorized',
  403: 'errors.status.forbidden',
  404: 'errors.status.notFound',
  409: 'errors.status.conflict',
  500: 'errors.status.server',
}
