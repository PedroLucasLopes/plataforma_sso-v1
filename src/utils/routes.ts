import type { ProjectOverview, RoleName } from '@/types/sso'
import { ROLE_NAMES, ROLE_STATUS } from '@/constants/status'

export type ProjectRoute = ProjectOverview['routes'][number]
export type ProjectRole = ProjectOverview['roles'][number]

/** Rota do projeto no formato da arvore de `@pedrolucaslopes/dotlog-ui`. */
export interface RouteEntry extends ProjectRoute {
  /** Marca no no da arvore. */
  warning?: string
}

export const NO_ROLE_WARNING = 'No role granted'

/**
 * Rotas do projeto para a arvore. A que nenhum papel alcanca responde 403 a
 * todo mundo, e sai marcada: e o tipo de coisa que so se descobre quando
 * alguem reclama.
 */
export function routeEntries (project: ProjectOverview): RouteEntry[] {
  const granted = new Set(project.roles.flatMap(role => role.permissions.map(permission => permission.routeId)))

  return project.routes.map(route => (granted.has(route.id) ? { ...route } : { ...route, warning: NO_ROLE_WARNING }))
}

/** Papeis com permissao para a rota. */
export function rolesGranted (project: ProjectOverview, routeId: string): ProjectRole[] {
  return project.roles.filter(role => role.permissions.some(permission => permission.routeId === routeId))
}

export const roleLabel = (name: RoleName): string => ROLE_STATUS[name]?.label ?? name

/** Do mais amplo para o mais restrito, na mesma ordem dos seletores. */
export function sortRoles (roles: ProjectRole[]): ProjectRole[] {
  return roles.toSorted((a, b) => ROLE_NAMES.indexOf(a.name) - ROLE_NAMES.indexOf(b.name))
}
