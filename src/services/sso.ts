/**
 * Endpoints do SSO, um grupo por recurso.
 *
 * O caminho e o do catalogo de rotas do SSO, sem o prefixo global. E o mesmo
 * texto que as permissoes usam, o que deixa a tela perguntar `can('POST',
 * '/project')` com a mesma string que vai na chamada.
 */
import type {
  ClientKey,
  GeneratedClientKey,
  ListQuery,
  LoginRequestView,
  Me,
  Project,
  ProjectOverview,
  ProjectStatus,
  RedirectUri,
  Role,
  RoleInput,
  RoleName,
  Route,
  RouteInput,
  SessionView,
  User,
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

  /** Navegacao de pagina, nunca fetch: o SSO responde com redirect. */
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
  /** `authId: null` desfaz o vinculo com a conta Google; o proximo login fixa outro. */
  update: (userId: string, body: Partial<UserInput> & { authId?: null }) =>
    request<User>(`/user/${id(userId)}`, { method: 'PUT', body }),
  remove: (userId: string) => request<void>(`/user/${id(userId)}`, { method: 'DELETE' }),
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
  list: (query: ListQuery & { name?: RoleName } = {}) =>
    request<Role[]>('/role', { query, emptyOn404: true }),
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
