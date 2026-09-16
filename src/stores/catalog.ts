import type { Project, Route, User } from '@/types/sso'
import { defineStore } from 'pinia'
import { reactive, shallowRef } from 'vue'
import { LOOKUP_LIMIT } from '@/constants/layout'
import { t } from '@/plugins/i18n'
import { errorMessage } from '@/services/http'
import { projectsApi, routesApi, usersApi } from '@/services/sso'

export type CatalogKind = 'projects' | 'users' | 'routes'

interface LoadState {
  loading: boolean
  loaded: boolean
  error: string | null
}

const idle = (): LoadState => ({ loading: false, loaded: false, error: null })

/**
 * Catalogo inteiro de cada recurso, ate `LOOKUP_LIMIT`.
 *
 * Serve ao que precisa de tudo de uma vez: seletor de projeto, nome no lugar
 * de id e painel. Projetos filtram e paginam no navegador. Usuarios crescem com
 * o uso e paginam no servidor, no store proprio.
 *
 * Papeis nao tem lista global: moram dentro de cada projeto, e chegam no
 * overview dele. Rotas tambem moram no projeto, em arvore, e aqui entram so
 * para a contagem do painel.
 *
 * Quem altera um recurso chama `invalidate`; a proxima tela que precisar
 * busca de novo.
 */
export const useCatalogStore = defineStore('catalog', () => {
  const projects = shallowRef<Project[]>([])
  const users = shallowRef<User[]>([])
  const routes = shallowRef<Route[]>([])

  const state = reactive<Record<CatalogKind, LoadState>>({
    projects: idle(),
    users: idle(),
    routes: idle(),
  })

  const loaders: Record<CatalogKind, () => Promise<void>> = {
    projects: async () => {
      projects.value = await projectsApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
    },
    users: async () => {
      users.value = await usersApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
    },
    routes: async () => {
      routes.value = await routesApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
    },
  }

  const inflight = new Map<CatalogKind, Promise<void>>()

  function ensure (kind: CatalogKind, force = false): Promise<void> {
    if (!force && state[kind].loaded) {
      return Promise.resolve()
    }

    const running = inflight.get(kind)

    if (running) {
      return running
    }

    const task = (async () => {
      state[kind].loading = true
      state[kind].error = null

      try {
        await loaders[kind]()
        state[kind].loaded = true
      } catch (error) {
        state[kind].error = errorMessage(error)
        throw error
      } finally {
        state[kind].loading = false
        inflight.delete(kind)
      }
    })()

    inflight.set(kind, task)

    return task
  }

  function invalidate (...kinds: CatalogKind[]): void {
    for (const kind of kinds) {
      state[kind].loaded = false
    }
  }

  const projectName = (projectId: string): string =>
    projects.value.find(project => project.id === projectId)?.name ?? t('common.unknownProject')

  return { projects, users, routes, state, ensure, invalidate, projectName }
})
