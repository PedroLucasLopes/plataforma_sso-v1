import type { SignInError } from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'

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

export const PROVIDER_ICONS: Record<string, string> = {
  google: 'mdi-google',
}

export const ERROR_CODES: ReadonlySet<string> = new Set([
  'no_results',
  'validation_failed',
  'duplicate',
  'internal_error',
  'invalid_credentials',
  'account_locked',
  'password_refused',
  'password_not_issued',
  'mfa_code_invalid',
  'login_step_expired',
  'no_pending_request',
  'csrf_token_invalid',
  'origin_not_allowed',
  'sso_access_denied',
  'sso_project_protected',
  'sso_last_superadmin',
  'sso_redirect_uri_last',
  'sso_redirect_uri_in_use',
  'project_not_found',
  'client_key_required',
  'project_has_members',
  'project_has_routes',
  'user_not_found',
  'user_has_projects',
  'member_not_found',
  'role_not_found',
  'role_not_in_project',
  'route_not_found',
  'permission_not_found',
  'role_route_project_mismatch',
  'redirect_uri_not_found',
  'client_key_not_found',
  'client_keys_empty',
  'public_key_invalid',
  'public_key_not_rsa',
  'public_key_too_short',
])

const FIELD_ERROR_CODES: ReadonlySet<string> = new Set([
  'role_name_invalid',
  'public_key_not_pem',
  'email_invalid',
])

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

export function apiErrorText (code: string | null, body: Record<string, unknown>): string | null {
  if (!code || !ERROR_CODES.has(code)) {
    return null
  }

  return code === 'validation_failed' ? validationMessage(body) : t(`errors.code.${code}`)
}

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
