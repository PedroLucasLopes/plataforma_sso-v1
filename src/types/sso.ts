/**
 * Contratos do SSO, espelhando os DTOs e o `schema.prisma` do backend.
 *
 * Datas chegam como texto ISO: o JSON nao tem tipo de data.
 */
import type { Permission } from '@pedrolucaslopes/dotlog-ui'

export type ProjectStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'
/** Os quatro papeis com que todo projeto nasce, vazios. */
export type DefaultRoleName = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'VIEWER'
/** Nome de papel: um dos padrao, ou um de nome livre, como ARQUITETO. */
export type RoleName = string
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'UPDATE'

/* -------------------------------- sessao -------------------------------- */

/** `GET /sso/me`: quem entrou e o que o papel alcanca no console. */
export interface Me {
  id: string
  email: string
  name: string
  role: RoleName
  /**
   * SUPERADMIN do projeto `SSO`. A raiz alcanca toda rota administrativa, e
   * `permissions` traz todas as que o servidor expoe, cadastradas ou nao.
   */
  root: boolean
  permissions: Permission[]
  csrfToken?: string
}

/** `GET /sso/session`: a sessao do navegador, com ou sem papel no console. */
export interface SessionView {
  active: boolean
  user?: { name: string, email: string }
  csrfToken?: string
}

/** `GET /sso/login/request`: o pedido que a tela de login esta atendendo. */
export interface LoginRequestView {
  kind: 'authorize' | 'session'
  application: string | null
  expiresAt: string
  providers: { id: string, label: string, url: string }[]
}

/* ------------------------------- catalogo ------------------------------- */

export interface ProjectMembershipLink {
  userId: string
  projectId: string
  roleId: string
}

export interface Project {
  id: string
  name: string
  clientId: string
  status: ProjectStatus
  createdAt: string
  activatedAt: string | null
  suspendedAt: string | null
  /** Presente em `GET /project`. */
  projectUsers?: ProjectMembershipLink[]
}

export interface ProjectOverview {
  id: string
  name: string
  status: ProjectStatus
  clientId: string
  createdAt: string
  activatedAt: string | null
  suspendedAt: string | null
  redirectUris: string[]
  redirectUriRecords: { id: string, redirectUri: string }[]
  clientKeys: { id: string, createdAt: string, expiresAt: string | null, revokedAt: string | null }[]
  routes: { id: string, method: HttpMethod, path: string }[]
  roles: {
    id: string
    name: RoleName
    permissions: { id: string, routeId: string, method: HttpMethod, path: string }[]
  }[]
  users: { id: string, name: string, email: string, role: RoleName, grantedRoutes: number }[]
}

export interface User {
  id: string
  email: string
  name: string
  /** Id da conta Google, fixado no primeiro login. `null` ate la. */
  authId: string | null
  /** `GET /user` traz o projeto; `GET /user/:id` traz tambem o papel. */
  projectUsers?: {
    project: Project
    role: { id?: string, name?: RoleName, projectId?: string }
  }[]
}

export interface Route {
  id: string
  path: string
  method: HttpMethod
  projectId: string
  /** `GET /route` traz o nome do papel de cada permissao. */
  permissions?: { role: { name: RoleName } }[]
}

export interface Role {
  id: string
  name: RoleName
  projectId: string
  /** `GET /role` traz a rota de cada permissao. */
  permissions?: { route: Route }[]
}

export interface ClientKey {
  id: string
  projectId: string
  algorithm: string
  publicKeyPem: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
}

/** Resposta de exibicao unica. Nunca vai para store, log ou armazenamento. */
export interface GeneratedClientKey {
  id: string
  projectId: string
  publicKeyPem: string
  privateKeyBase64: string
  warning: string
}

export interface RedirectUri {
  id: string
  redirectUri: string
  projectId: string
}

/* ------------------------------- entradas ------------------------------- */

export interface ListQuery {
  page?: number
  limit?: number
  order?: 'asc' | 'desc'
}

export interface UserInput {
  name: string
  email: string
}

export interface RouteInput {
  path: string
  method: HttpMethod
  projectId: string
}

export interface RoleInput {
  name: RoleName
  projectId: string
}
