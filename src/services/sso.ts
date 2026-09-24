import type {
  ClientKey,
  GeneratedClientKey,
  IssuedPassword,
  ListQuery,
  LoginRequestView,
  LoginStepView,
  Me,
  Project,
  ProjectOverview,
  ProjectStatus,
  RedirectUri,
  Role,
  RoleInput,
  Route,
  RouteInput,
  SessionView,
  User,
  UserCredentialView,
  UserInput,
} from '@/types/sso'
import { API_PREFIX } from '@/constants/api'
import { request } from './http'

const id = (value: string): string => encodeURIComponent(value)

export const sessionApi = {
  me: () => request<Me>('/me', { redirectOnUnauthorized: false }),
  current: () => request<SessionView>('/session', { redirectOnUnauthorized: false }),
  loginRequest: () => request<LoginRequestView>('/login/request', { redirectOnUnauthorized: false }),
  logout: () => request<void>('/session/logout', { method: 'POST', redirectOnUnauthorized: false }),

  loginPassword: (body: { email: string, password: string }) =>
    request<LoginStepView>('/login/password', { method: 'POST', body, redirectOnUnauthorized: false }),
  changePassword: (body: { password: string }) =>
    request<LoginStepView>('/login/password/change', { method: 'POST', body, redirectOnUnauthorized: false }),
  setupMfa: () =>
    request<LoginStepView>('/login/mfa/setup', { method: 'POST', redirectOnUnauthorized: false }),
  confirmMfa: (body: { code: string }) =>
    request<LoginStepView>('/login/mfa/confirm', { method: 'POST', body, redirectOnUnauthorized: false }),
  verifyMfa: (body: { code: string }) =>
    request<LoginStepView>('/login/mfa', { method: 'POST', body, redirectOnUnauthorized: false }),

  loginUrl: (redirectUri: string, state: string): string =>
    `${API_PREFIX}/session/login?${new URLSearchParams({ redirect_uri: redirectUri, state })}`,
}

export const projectsApi = {
  list: (query: ListQuery & { name?: string } = {}) =>
    request<Project[]>('/project', { query, emptyOn404: true }),
  get: (projectId: string) => request<Project>(`/project/${id(projectId)}`),
  overview: (projectId: string) => request<ProjectOverview>(`/project/${id(projectId)}/overview`),
  create: (body: { name: string }) => request<Project>('/project', { method: 'POST', body }),
  update: (projectId: string, body: { name: string }) =>
    request<Project>(`/project/${id(projectId)}`, { method: 'PUT', body }),
  remove: (projectId: string) => request<void>(`/project/${id(projectId)}`, { method: 'DELETE' }),
  setStatus: (projectId: string, status: ProjectStatus) =>
    request<Project>(`/project/${id(projectId)}/status`, { method: 'PATCH', body: { status } }),
}

export const usersApi = {
  list: (query: ListQuery & { name?: string, email?: string } = {}) =>
    request<User[]>('/user', { query, emptyOn404: true }),
  get: (userId: string) => request<User>(`/user/${id(userId)}`),
  create: (body: UserInput) => request<User>('/user', { method: 'POST', body }),
  update: (userId: string, body: Partial<UserInput> & { authId?: null }) =>
    request<User>(`/user/${id(userId)}`, { method: 'PUT', body }),
  remove: (userId: string) => request<void>(`/user/${id(userId)}`, { method: 'DELETE' }),

  credential: (userId: string) =>
    request<UserCredentialView>(`/user/${id(userId)}/credential`),
  issuePassword: (userId: string) =>
    request<IssuedPassword>(`/user/${id(userId)}/password`, { method: 'POST' }),
  revokePassword: (userId: string) =>
    request<void>(`/user/${id(userId)}/password`, { method: 'DELETE' }),
  resetMfa: (userId: string) =>
    request<void>(`/user/${id(userId)}/mfa`, { method: 'DELETE' }),
}

export const routesApi = {
  list: (query: ListQuery & { path?: string, method?: string } = {}) =>
    request<Route[]>('/route', { query, emptyOn404: true }),
  create: (body: RouteInput) => request<Route>('/route', { method: 'POST', body }),
  update: (routeId: string, body: Partial<RouteInput>) =>
    request<Route>(`/route/${id(routeId)}`, { method: 'PUT', body }),
  remove: (routeId: string) => request<void>(`/route/${id(routeId)}`, { method: 'DELETE' }),
}

export const rolesApi = {
  create: (body: RoleInput) => request<Role>('/role', { method: 'POST', body }),
  update: (roleId: string, body: Partial<RoleInput>) =>
    request<Role>(`/role/${id(roleId)}`, { method: 'PUT', body }),
  remove: (roleId: string) => request<void>(`/role/${id(roleId)}`, { method: 'DELETE' }),
}

export const permissionsApi = {
  grant: (body: { roleId: string, routeId: string }) =>
    request<{ id: string }>('/permission', { method: 'POST', body }),
  revoke: (permissionId: string) =>
    request<void>(`/permission/${id(permissionId)}`, { method: 'DELETE' }),
}

export const membersApi = {
  add: (body: { userId: string, projectId: string, roleId: string }) =>
    request<void>('/projectuser', { method: 'POST', body }),
  changeRole: (projectId: string, userId: string, roleId: string) =>
    request<void>(`/projectuser/${id(projectId)}/${id(userId)}`, { method: 'PUT', body: { roleId } }),
  remove: (projectId: string, userId: string) =>
    request<void>(`/projectuser/${id(projectId)}/${id(userId)}`, { method: 'DELETE' }),
}

export const redirectUrisApi = {
  create: (body: { projectId: string, redirectUri: string }) =>
    request<RedirectUri>('/redirecturi', { method: 'POST', body }),
  update: (redirectUriId: string, body: { redirectUri: string }) =>
    request<RedirectUri>(`/redirecturi/${id(redirectUriId)}`, { method: 'PUT', body }),
  remove: (redirectUriId: string) =>
    request<void>(`/redirecturi/${id(redirectUriId)}`, { method: 'DELETE' }),
}

export const clientKeysApi = {
  list: (projectId: string) =>
    request<ClientKey[]>('/clientkey', { query: { projectId }, emptyOn404: true }),
  register: (body: { projectId: string, publicKeyPem: string, expiresAt?: string }) =>
    request<ClientKey>('/clientkey', { method: 'POST', body }),
  generate: (projectId: string) =>
    request<GeneratedClientKey>('/clientkey/generate', { method: 'POST', body: { projectId } }),
  revoke: (keyId: string) => request<void>(`/clientkey/${id(keyId)}`, { method: 'DELETE' }),
}
