import type { DefaultRoleName, HttpMethod, ProjectStatus } from '@/types/sso'
import type { StatusDefinition } from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'

function labelled<Key extends string> (
  group: string,
  looks: Record<Key, Omit<StatusDefinition, 'label'>>,
): Record<Key, StatusDefinition> {
  const entries = Object.entries(looks) as [
    Key,
    Omit<StatusDefinition, 'label'>,
  ][]

  return Object.fromEntries(
    entries.map(([key, look]) => [
      key,
      {
        ...look,
        get label () {
          return t(`status.${group}.${key}`)
        },
      },
    ]),
  ) as Record<Key, StatusDefinition>
}

export const PROJECT_STATUS = labelled<ProjectStatus>('project', {
  ACTIVE: { tone: 'success', icon: 'mdi-check-circle-outline' },
  PENDING: { tone: 'warning', icon: 'mdi-clock-outline' },
  SUSPENDED: { tone: 'error', icon: 'mdi-pause-circle-outline' },
})

export const ROLE_STATUS: Record<DefaultRoleName, StatusDefinition> = {
  SUPERADMIN: {
    label: 'SUPERADMIN',
    tone: 'dark',
    icon: 'mdi-shield-crown-outline',
  },
  ADMIN: {
    label: 'ADMIN',
    tone: 'info',
    icon: 'mdi-shield-account-outline',
  },
  MANAGER: {
    label: 'MANAGER',
    tone: 'neutral',
    icon: 'mdi-account-tie-outline',
  },
  VIEWER: { label: 'VIEWER', tone: 'neutral', icon: 'mdi-eye-outline' },
}

export const CUSTOM_ROLE_ICON = 'mdi-shield-edit-outline'

export type KeyState = 'ACTIVE' | 'EXPIRED' | 'REVOKED'

export const KEY_STATUS = labelled<KeyState>('key', {
  ACTIVE: { tone: 'success', icon: 'mdi-key-variant' },
  EXPIRED: { tone: 'warning', icon: 'mdi-timer-sand-complete' },
  REVOKED: { tone: 'dark', icon: 'mdi-key-remove' },
})

export type LinkState = 'LINKED' | 'WAITING'

export const LINK_STATUS = labelled<LinkState>('link', {
  LINKED: { tone: 'success', icon: 'mdi-google' },
  WAITING: { tone: 'neutral', icon: 'mdi-clock-outline' },
})

export const DEFAULT_ROLE_NAMES: DefaultRoleName[] = [
  'SUPERADMIN',
  'ADMIN',
  'MANAGER',
  'VIEWER',
]

export const ROOT_ROLE_NAME: DefaultRoleName = 'SUPERADMIN'

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]

export { httpMethodStatus as METHOD_STATUS } from '@pedrolucaslopes/dotlog-ui'
