export const API_PREFIX = '/sso'

export const CALLBACK_PATH = '/callback'

export const SESSION_RECHECK_MS = 30_000

export const LOGIN_PATH = '/login'

export const LOGIN_ATTEMPT_STORAGE_KEY = 'sso.console.login'

export const LOGIN_ATTEMPT_TTL_MS = 10 * 60 * 1000

export const SELF_PROJECT_NAME = 'SSO'

export const LINK_PATH = '/link'

export const HUMAN_CHECK_HEADER = 'x-human-check'

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export const LOGO_MAX_BYTES = 48 * 1024

export const LOGO_TYPES = 'image/png,image/jpeg,image/webp'

export const DISPLAY_NAME_MAX_LENGTH = 60
