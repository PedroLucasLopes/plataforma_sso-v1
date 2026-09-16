/**
 * router/index.ts
 *
 * Rotas declaradas a mao. Cada tela do console diz qual permissao a libera,
 * com o mesmo metodo e caminho do catalogo de rotas do SSO. O guard pergunta
 * isso antes de montar a tela, e o backend pergunta de novo em cada chamada.
 */

import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { APP_NAME } from '@/constants/layout'
import { i18n, t } from '@/plugins/i18n'
import { useSessionStore } from '@/stores/session'
import { routeLoading } from './loading'

declare module 'vue-router' {
  interface RouteMeta {
    /** Chave de traducao do titulo da aba. */
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
    meta: { public: true, title: 'pageTitles.login' },
  },
  {
    path: '/callback',
    name: 'callback',
    component: () => import('@/pages/CallbackPage.vue'),
    meta: { public: true, title: 'pageTitles.callback' },
  },
  {
    path: '/no-access',
    name: 'no-access',
    component: () => import('@/pages/NoAccessPage.vue'),
    meta: { public: true, title: 'pageTitles.noAccess' },
  },
  {
    path: '/unavailable',
    name: 'unavailable',
    component: () => import('@/pages/UnavailablePage.vue'),
    meta: { public: true, title: 'pageTitles.unavailable' },
  },
  {
    path: '/',
    component: () => import('@/layouts/ConsoleLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: 'pageTitles.dashboard', nav: 'dashboard' },
      },
      {
        path: 'projects',
        name: 'projects',
        component: () => import('@/pages/projects/ProjectsPage.vue'),
        meta: { title: 'pageTitles.projects', nav: 'project', permission: { method: 'GET', path: '/project' } },
      },
      {
        path: 'projects/:id',
        name: 'project',
        component: () => import('@/pages/projects/ProjectDetailPage.vue'),
        meta: { title: 'pageTitles.project', nav: 'project', permission: { method: 'GET', path: '/project/:id' } },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/pages/users/UsersPage.vue'),
        meta: { title: 'pageTitles.users', nav: 'user', permission: { method: 'GET', path: '/user' } },
      },
      {
        path: 'users/:id',
        name: 'user',
        component: () => import('@/pages/users/UserDetailPage.vue'),
        meta: { title: 'pageTitles.user', nav: 'user', permission: { method: 'GET', path: '/user/:id' } },
      },
      {
        path: 'client-keys',
        name: 'client-keys',
        component: () => import('@/pages/ClientKeysPage.vue'),
        meta: { title: 'pageTitles.clientKeys', nav: 'clientkey', permission: { method: 'GET', path: '/clientkey' } },
      },
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/pages/ForbiddenPage.vue'),
        meta: { title: 'pageTitles.forbidden' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
        meta: { title: 'pageTitles.notFound' },
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

function applyTitle (to: RouteLocationNormalized): void {
  document.title = to.meta.title ? `${t(to.meta.title)} · ${APP_NAME}` : APP_NAME
}

router.afterEach(to => {
  routeLoading.value = false
  applyTitle(to)
})

// O titulo da aba acompanha a troca de lingua, sem esperar a proxima navegacao.
watch(i18n.global.locale, () => applyTitle(router.currentRoute.value))

router.onError(() => {
  routeLoading.value = false
})

export default router
