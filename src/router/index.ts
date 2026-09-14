/**
 * router/index.ts
 *
 * Rotas declaradas a mao. Cada tela do console diz qual permissao a libera,
 * com o mesmo metodo e caminho do catalogo de rotas do SSO. O guard pergunta
 * isso antes de montar a tela, e o backend pergunta de novo em cada chamada.
 */

import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { APP_NAME } from '@/constants/layout'
import { useSessionStore } from '@/stores/session'
import { routeLoading } from './loading'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Nao exige sessao: login do IdP, volta do login, sem acesso, indisponivel. */
    public?: boolean
    /** `key` do item de menu que fica ativo. */
    nav?: string
    /** Permissao que libera a tela. Sem ela, a tela de "nao permitido". */
    permission?: { method: string, path: string }
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true, title: 'Sign in' },
  },
  {
    path: '/callback',
    name: 'callback',
    component: () => import('@/pages/CallbackPage.vue'),
    meta: { public: true, title: 'Signing in' },
  },
  {
    path: '/no-access',
    name: 'no-access',
    component: () => import('@/pages/NoAccessPage.vue'),
    meta: { public: true, title: 'No access' },
  },
  {
    path: '/unavailable',
    name: 'unavailable',
    component: () => import('@/pages/UnavailablePage.vue'),
    meta: { public: true, title: 'Unavailable' },
  },
  {
    path: '/',
    component: () => import('@/layouts/ConsoleLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: 'Overview', nav: 'dashboard' },
      },
      {
        path: 'projects',
        name: 'projects',
        component: () => import('@/pages/projects/ProjectsPage.vue'),
        meta: { title: 'Projects', nav: 'project', permission: { method: 'GET', path: '/project' } },
      },
      {
        path: 'projects/:id',
        name: 'project',
        component: () => import('@/pages/projects/ProjectDetailPage.vue'),
        meta: { title: 'Project', nav: 'project', permission: { method: 'GET', path: '/project/:id' } },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/pages/users/UsersPage.vue'),
        meta: { title: 'Users', nav: 'user', permission: { method: 'GET', path: '/user' } },
      },
      {
        path: 'users/:id',
        name: 'user',
        component: () => import('@/pages/users/UserDetailPage.vue'),
        meta: { title: 'User', nav: 'user', permission: { method: 'GET', path: '/user/:id' } },
      },
      {
        path: 'roles',
        name: 'roles',
        component: () => import('@/pages/RolesPage.vue'),
        meta: { title: 'Roles', nav: 'role', permission: { method: 'GET', path: '/role' } },
      },
      {
        path: 'client-keys',
        name: 'client-keys',
        component: () => import('@/pages/ClientKeysPage.vue'),
        meta: { title: 'Client keys', nav: 'clientkey', permission: { method: 'GET', path: '/clientkey' } },
      },
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/pages/ForbiddenPage.vue'),
        meta: { title: 'Not allowed' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
        meta: { title: 'Not found' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach(async to => {
  if (to.meta.public) {
    return true
  }

  routeLoading.value = true

  const session = useSessionStore()
  const status = await session.ensure()

  // Sem sessao, o console faz o que qualquer aplicacao faz: manda ao SSO com a
  // redirect_uri registrada, e volta para esta mesma URL depois.
  if (status === 'unauthenticated') {
    session.beginLogin(to.fullPath)

    return false
  }

  if (status === 'no-access') {
    return { name: 'no-access' }
  }

  if (status === 'unavailable') {
    return { name: 'unavailable', query: { from: to.fullPath } }
  }

  const permission = to.meta.permission

  if (permission && !session.can(permission.method, permission.path)) {
    return { name: 'forbidden', query: { from: to.fullPath } }
  }

  return true
})

router.afterEach(to => {
  routeLoading.value = false
  document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME
})

router.onError(() => {
  routeLoading.value = false
})

export default router
