import {
  deriveNavGroups,
  type NavGroup,
  type NavOverride,
  type Permission,
} from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'

export function buildNavGroups (permissions: Permission[]): NavGroup[] {
  const overrides: Record<string, NavOverride> = {
    '/project': { label: t('nav.projects'), icon: 'mdi-apps', to: '/projects', group: 'catalogue', order: 1 },
    '/user': { label: t('nav.users'), icon: 'mdi-account-multiple-outline', to: '/users', group: 'catalogue', order: 2 },
    '/role': { hidden: true },
    '/route': { hidden: true },
    '/clientkey': { label: t('nav.clientKeys'), icon: 'mdi-key-variant', to: '/client-keys', group: 'credentials', order: 1 },
  }

  const groups = [
    { key: 'catalogue', title: t('nav.catalogue') },
    { key: 'credentials', title: t('nav.credentials') },
  ]

  return [
    { key: 'home', items: [{ key: 'dashboard', label: t('nav.overview'), icon: 'mdi-view-dashboard-outline', to: '/' }] },
    ...deriveNavGroups(permissions, { overrides, groups }),
  ]
}
