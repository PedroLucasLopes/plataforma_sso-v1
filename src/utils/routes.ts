import type { DefaultRoleName, ProjectOverview } from '@/types/sso'
import type { StatusDefinition } from '@pedrolucaslopes/dotlog-ui'
import { DEFAULT_ROLE_NAMES, ROLE_STATUS } from '@/constants/status'
import { t } from '@/plugins/i18n'

export type ProjectRoute = ProjectOverview['routes'][number]
export type ProjectRole = ProjectOverview['roles'][number]

/** Rota do projeto no formato da arvore de `@pedrolucaslopes/dotlog-ui`. */
export interface RouteEntry extends ProjectRoute {
  /** Marca no no da arvore. */
  warning?: string
}

/**
 * Rotas do projeto para a arvore. A que nenhum papel alcanca responde 404 a
 * todo mundo, como se nao existisse, e sai marcada: e o tipo de coisa que so se
 * descobre quando alguem reclama.
 */
export function routeEntries (project: ProjectOverview): RouteEntry[] {
  const granted = new Set(project.roles.flatMap(role => role.permissions.map(permission => permission.routeId)))

  return project.routes.map(route => (granted.has(route.id) ? { ...route } : { ...route, warning: t('routes.noRoleGranted') }))
}

/** Papeis com permissao para a rota. */
export function rolesGranted (project: ProjectOverview, routeId: string): ProjectRole[] {
  return project.roles.filter(role => role.permissions.some(permission => permission.routeId === routeId))
}

export function isDefaultRole (name: string): name is DefaultRoleName {
  return (DEFAULT_ROLE_NAMES as string[]).includes(name)
}

/** Pastilha do papel. O padrao tem desenho proprio; o de nome livre aparece como foi nomeado. */
export function roleDefinition (name: string): StatusDefinition {
  return isDefaultRole(name) ? ROLE_STATUS[name] : { label: name, tone: 'neutral' }
}

export const roleLabel = (name: string): string => roleDefinition(name).label

/** Os padrao primeiro, do mais amplo ao mais restrito; depois os de nome livre, em ordem alfabetica. */
export function compareRoleNames (a: string, b: string): number {
  const rank = (name: string): number => {
    const index = DEFAULT_ROLE_NAMES.indexOf(name as DefaultRoleName)

    return index === -1 ? DEFAULT_ROLE_NAMES.length : index
  }

  return rank(a) - rank(b) || a.localeCompare(b)
}

export function sortRoles<Role extends { name: string }> (roles: Role[]): Role[] {
  return roles.toSorted((a, b) => compareRoleNames(a.name, b.name))
}
