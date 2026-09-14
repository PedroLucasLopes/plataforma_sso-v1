import type { SignInError } from '@pedrolucaslopes/dotlog-ui'

/**
 * O que a tela de login diz para cada codigo que o SSO manda.
 *
 * So codigo conhecido vira mensagem. Texto livre lido da URL nunca aparece na
 * tela de login: e a pagina de maior confianca do ecossistema, e seria um mural
 * para quem quisesse enganar alguem.
 */
export const LOGIN_ERRORS: Record<string, SignInError> = {
  no_pending_request: {
    title: 'There is no sign-in waiting here',
    description: 'Open the application you want to use. It will bring you back to this page.',
  },
  request_expired: {
    title: 'The sign-in request expired',
    description: 'A request lasts five minutes. Go back to the application and start again.',
  },
  account_not_registered: {
    title: 'This Google account is not registered',
    description: 'Ask an administrator to add your e-mail to the SSO, then try again.',
  },
  email_not_verified: {
    title: 'Your Google e-mail is not verified',
    description: 'Verify the address in your Google account and try again.',
  },
  account_mismatch: {
    title: 'This is not the Google account linked to you',
    description: 'Use the Google account from your first sign-in, or ask an administrator to unlink it.',
  },
  provider_denied: {
    title: 'Sign-in was cancelled',
    description: 'Google did not share your identity. Choose the provider again when you are ready.',
  },
  provider_error: {
    title: 'Google could not complete the sign-in',
    description: 'Nothing was changed. Try again in a moment.',
  },
}

export const GENERIC_LOGIN_ERROR: SignInError = {
  title: 'Sign-in could not be completed',
  description: 'Go back to the application and try again.',
}

/** Icone de cada provedor. O SSO manda o id; o desenho e do front. */
export const PROVIDER_ICONS: Record<string, string> = {
  google: 'mdi-google',
}

/**
 * Mensagens do backend escritas para quem opera a API, traduzidas para quem
 * usa o console. A chave e o texto exato que o servidor devolve.
 */
export const API_MESSAGES: Record<string, string> = {
  'cadastre ao menos uma chave publica em /clientkey antes de ativar':
    'Register at least one client key before activating the project.',
  'This project have ongoing permissions':
    'Add no one else and remove the members of this project before deleting it.',
  'Some routes are associated with this project':
    'Delete the routes of this project before deleting it.',
  'This user have ongoing permissions':
    'This user still has access to a project. Remove the memberships first.',
  'You cannot associate roles from different projects':
    'The role and the route belong to different projects.',
  'publicKeyPem deve ser uma chave publica em PEM (SPKI)':
    'Paste a public key in PEM format, starting with -----BEGIN PUBLIC KEY-----.',
  'publicKeyPem nao e uma chave valida': 'This is not a valid public key.',
  'apenas chaves RSA sao aceitas (RS256)': 'Only RSA keys are accepted (RS256).',
  'a chave RSA precisa ter ao menos 2048 bits': 'The RSA key must have at least 2048 bits.',
  'Chave nao encontrada ou ja revogada': 'The key was not found or is already revoked.',
  'Nenhuma chave cadastrada para este projeto': 'This project has no client keys yet.',
}

/** Mensagem por codigo de erro nomeado, quando o backend manda um. */
export const CODE_MESSAGES: Record<string, string> = {
  csrf_token_invalid: 'Your security token is out of date. Reload the page and try again.',
  origin_not_allowed: 'This request did not come from the console and was refused.',
  sso_project_protected: 'The SSO project runs the administration of every application, so this change is refused. Its routes, roles and permissions change only through scripts/bootstrap-sso.js.',
  sso_redirect_uri_last: 'The SSO project needs at least one redirect URI. Add the new address before deleting this one.',
  sso_redirect_uri_in_use: 'This console signs in through this address. Delete it from a console running at another address.',
}

/** Ultimo recurso, por status HTTP. */
export const STATUS_MESSAGES: Record<number, string> = {
  0: 'The SSO did not respond. Check your connection and try again.',
  401: 'Your session ended. Sign in again to continue.',
  403: 'Your role does not allow this action.',
  404: 'The record was not found. It may have been removed.',
  409: 'A record with these values already exists.',
  500: 'The SSO could not process the request. Nothing was changed.',
}
