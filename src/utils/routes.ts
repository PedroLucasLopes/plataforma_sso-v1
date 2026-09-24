import type { DefaultRoleName, ProjectOverview } from '@/types/sso'
import type { StatusDefinition } from '@pedrolucaslopes/dotlog-ui'
import {
  CUSTOM_ROLE_ICON,
  DEFAULT_ROLE_NAMES,
  ROLE_STATUS,
} from '@/constants/status'
import { t } from '@/plugins/i18n'

export type ProjectRoute = ProjectOverview['routes'][number]
export type ProjectRole = ProjectOverview['roles'][number]

export interface RouteEntry extends ProjectRoute {
  warning?: string
}

export function routeEntries (project: ProjectOverview): RouteEntry[] {
  const granted = new Set(
    project.roles.flatMap(role =>
      role.permissions.map(permission => permission.routeId),
    ),
  )

  return project.routes.map(route =>
    granted.has(route.id)
      ? { ...route }
      : { ...route, warning: t('routes.noRoleGranted') },
  )
}

export function rolesGranted (
  project: ProjectOverview,
  routeId: string,
): ProjectRole[] {
  return project.roles.filter(role =>
    role.permissions.some(permission => permission.routeId === routeId),
  )
}

export function isDefaultRole (name: string): name is DefaultRoleName {
  return (DEFAULT_ROLE_NAMES as string[]).includes(name)
}

export function customRoleLabel (name: string): string {
  const words = name.replaceAll('_', ' ').trim().toLowerCase()

  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function roleDefinition (name: string): StatusDefinition {
  return isDefaultRole(name)
    ? { ...ROLE_STATUS[name], label: customRoleLabel(ROLE_STATUS[name].label) }
    : { label: customRoleLabel(name), tone: 'neutral', icon: CUSTOM_ROLE_ICON }
}

export function roleChips (
  names: readonly string[],
): Record<string, StatusDefinition> {
  return Object.fromEntries(names.map(name => [name, roleDefinition(name)]))
}

export const roleLabel = (name: string): string => roleDefinition(name).label

export function compareRoleNames (a: string, b: string): number {
  const rank = (name: string): number => {
    const index = DEFAULT_ROLE_NAMES.indexOf(name as DefaultRoleName)

    return index === -1 ? DEFAULT_ROLE_NAMES.length : index
  }

  return rank(a) - rank(b) || a.localeCompare(b)
}

export function sortRoles<Role extends { name: string }> (
  roles: Role[],
): Role[] {
  return roles.toSorted((a, b) => compareRoleNames(a.name, b.name))
}
