import type { Permission } from '@pedrolucaslopes/dotlog-ui'

export type ProjectStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'
export type DefaultRoleName = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'VIEWER'
export type RoleName = string
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'UPDATE'

export interface Me {
  id: string
  email: string
  name: string
  role: RoleName
  root: boolean
  permissions: Permission[]
  csrfToken?: string
}

export interface SessionView {
  active: boolean
  user?: { name: string, email: string }
  csrfToken?: string
}

export interface LoginRequestView {
  kind: 'authorize' | 'session'
  application: string | null
  expiresAt: string
  providers: { id: string, label: string, url: string }[]
}

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
  clientKeys: {
    id: string
    createdAt: string
    expiresAt: string | null
    revokedAt: string | null
  }[]
  routes: { id: string, method: HttpMethod, path: string }[]
  roles: {
    id: string
    name: RoleName
    permissions: {
      id: string
      routeId: string
      method: HttpMethod
      path: string
    }[]
  }[]
  users: {
    id: string
    name: string
    email: string
    role: RoleName
    grantedRoutes: number
  }[]
}

export interface User {
  id: string
  email: string
  name: string
  authId: string | null
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
  permissions?: { role: { name: RoleName } }[]
}

export interface Role {
  id: string
  name: RoleName
  projectId: string
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
