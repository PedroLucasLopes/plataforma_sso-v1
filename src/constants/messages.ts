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
 * Os codigos que o SSO manda no campo `error`, com o texto em
 * `errors.code.<codigo>`. O backend diz qual erro foi; o console escolhe as
 * palavras, na lingua dele.
 *
 * So codigo desta lista vira frase. O resto cai na mensagem do status, e o
 * texto que o servidor escreve em `message` nunca vai para a tela: ele e para
 * quem le a resposta crua, e e por ali que um detalhe interno ou um valor
 * repetido da requisicao chegaria a quem usa.
 *
 * `login_required` e `invalid_token` nao estao aqui: todo 401 vira relogin
 * antes de virar mensagem. Codigo novo no SSO precisa entrar aqui e nos JSON
 * de traducao; sem isso, a tela mostra a mensagem do status.
 */
export const ERROR_CODES: ReadonlySet<string> = new Set([
  // gerais
  'no_results',
  'validation_failed',
  'duplicate',
  'internal_error',
  // sessao e escrita
  'csrf_token_invalid',
  'origin_not_allowed',
  'sso_access_denied',
  // protecao do projeto SSO
  'sso_project_protected',
  'sso_last_superadmin',
  'sso_redirect_uri_last',
  'sso_redirect_uri_in_use',
  // projeto, usuario e membro
  'project_not_found',
  'client_key_required',
  'project_has_members',
  'project_has_routes',
  'user_not_found',
  'user_has_projects',
  'member_not_found',
  // papel, rota, permissao e redirect URI
  'role_not_found',
  'role_not_in_project',
  'route_not_found',
  'permission_not_found',
  'role_route_project_mismatch',
  'redirect_uri_not_found',
  // chave de cliente
  'client_key_not_found',
  'client_keys_empty',
  'public_key_invalid',
  'public_key_not_rsa',
  'public_key_too_short',
])

/**
 * Codigos de campo que a validacao dos DTOs manda em `fields`, com o texto em
 * `errors.field.<codigo>`. Campo recusado sem codigo desta lista entra na
 * recusa generica de `validation_failed`.
 */
const FIELD_ERROR_CODES: ReadonlySet<string> = new Set([
  'role_name_invalid',
  'public_key_not_pem',
  'email_invalid',
])

/** A recusa da validacao: os campos com texto proprio, ou a recusa generica. */
function validationMessage (body: Record<string, unknown>): string {
  const fields = Array.isArray(body.fields) ? body.fields as unknown[] : []
  const codes = new Set<string>()

  for (const field of fields) {
    const code = field && typeof field === 'object' ? (field as { error?: unknown }).error : null

    if (typeof code === 'string' && FIELD_ERROR_CODES.has(code)) {
      codes.add(code)
    }
  }

  return codes.size > 0
    ? [...codes].map(code => t(`errors.field.${code}`)).join(' ')
    : t('errors.code.validation_failed')
}

/** O texto do erro na lingua da tela, ou `null` quando o codigo nao e desta lista. */
export function apiErrorText (code: string | null, body: Record<string, unknown>): string | null {
  if (!code || !ERROR_CODES.has(code)) {
    return null
  }

  return code === 'validation_failed' ? validationMessage(body) : t(`errors.code.${code}`)
}

/**
 * Quando o codigo nao e conhecido, por status HTTP. Cobre tambem o que o
 * framework responde sozinho, sem codigo, como o 404 de caminho e o 429 do
 * limite de requisicoes. `0` e o SSO que nao respondeu.
 */
export const STATUS_MESSAGE_KEYS: Readonly<Record<number, string>> = {
  0: 'errors.status.network',
  400: 'errors.status.badRequest',
  401: 'errors.status.unauthorized',
  403: 'errors.status.forbidden',
  404: 'errors.status.notFound',
  409: 'errors.status.conflict',
  413: 'errors.status.tooLarge',
  429: 'errors.status.tooManyRequests',
  500: 'errors.status.server',
}
