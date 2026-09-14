import type { HttpMethod, ProjectStatus, RoleName } from '@/types/sso'
import type { StatusDefinition } from '@pedrolucaslopes/dotlog-ui'

/** Situacao do projeto. `PENDING` e o estado de nascimento: existe, mas nao usa o SSO. */
export const PROJECT_STATUS: Record<ProjectStatus, StatusDefinition> = {
  ACTIVE: { label: 'Active', tone: 'success', icon: 'mdi-check-circle-outline' },
  PENDING: { label: 'Pending', tone: 'warning', icon: 'mdi-clock-outline' },
  SUSPENDED: { label: 'Suspended', tone: 'error', icon: 'mdi-pause-circle-outline' },
}

/** Papel. O de maior privilegio usa o tom de maior contraste, sem cor de alerta. */
export const ROLE_STATUS: Record<RoleName, StatusDefinition> = {
  SUPERADMIN: { label: 'Superadmin', tone: 'dark', icon: 'mdi-shield-crown-outline' },
  ADMIN: { label: 'Admin', tone: 'info', icon: 'mdi-shield-account-outline' },
  MANAGER: { label: 'Manager', tone: 'neutral', icon: 'mdi-account-tie-outline' },
  VIEWER: { label: 'Viewer', tone: 'neutral', icon: 'mdi-eye-outline' },
}

export type KeyState = 'ACTIVE' | 'EXPIRED' | 'REVOKED'

export const KEY_STATUS: Record<KeyState, StatusDefinition> = {
  ACTIVE: { label: 'Active', tone: 'success', icon: 'mdi-key-variant' },
  EXPIRED: { label: 'Expired', tone: 'warning', icon: 'mdi-timer-sand-complete' },
  REVOKED: { label: 'Revoked', tone: 'dark', icon: 'mdi-key-remove' },
}

export type LinkState = 'LINKED' | 'WAITING'

/** Vinculo com a conta Google, fixado no primeiro login. */
export const LINK_STATUS: Record<LinkState, StatusDefinition> = {
  LINKED: { label: 'Linked', tone: 'success', icon: 'mdi-google' },
  WAITING: { label: 'Waiting first sign-in', tone: 'neutral', icon: 'mdi-clock-outline' },
}

/** Na ordem do mais amplo para o mais restrito, como os seletores mostram. */
export const ROLE_NAMES: RoleName[] = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'VIEWER']

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export { httpMethodStatus as METHOD_STATUS } from '@pedrolucaslopes/dotlog-ui'
