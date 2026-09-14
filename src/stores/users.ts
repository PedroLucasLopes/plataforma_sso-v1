import type { User, UserInput } from '@/types/sso'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { membersApi, usersApi } from '@/services/sso'
import { useCatalogStore } from './catalog'
import { usePagedList } from './helpers/pagedList'

/** O backend valida `email` como endereco completo. Parcial vai como nome. */
const EMAIL = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/

/**
 * Pessoas cadastradas no SSO. Paginado no servidor: e a lista que cresce.
 *
 * A busca e uma caixa so. O filtro `email` do backend exige endereco
 * completo, entao texto com cara de e-mail vai como `email` e o resto como
 * `name`, que aceita trecho.
 */
export const useUsersStore = defineStore('users', () => {
  const catalog = useCatalogStore()

  const list = usePagedList<User, { name?: string, email?: string }>(
    query => usersApi.list({ ...query, order: 'asc' }),
    {},
  )

  const search = ref('')
  const current = ref<User | null>(null)

  function applySearch (term: string): Promise<void> {
    const value = term.trim()

    search.value = term

    return list.applyFilters(
      EMAIL.test(value)
        ? { email: value, name: undefined }
        : { name: value || undefined, email: undefined },
    )
  }

  async function fetchOne (userId: string): Promise<User> {
    current.value = await usersApi.get(userId)

    return current.value
  }

  async function create (input: UserInput): Promise<User> {
    const user = await usersApi.create(input)

    catalog.invalidate('users')
    await list.load()

    return user
  }

  async function update (userId: string, input: Partial<UserInput> & { authId?: null }): Promise<void> {
    await usersApi.update(userId, input)
    catalog.invalidate('users')

    if (list.loaded.value) {
      await list.load()
    }

    if (current.value?.id === userId) {
      await fetchOne(userId)
    }
  }

  async function remove (userId: string): Promise<void> {
    await usersApi.remove(userId)
    catalog.invalidate('users')

    if (current.value?.id === userId) {
      current.value = null
    }

    await list.load()
  }

  async function addMembership (userId: string, projectId: string, roleId: string): Promise<void> {
    await membersApi.add({ userId, projectId, roleId })
    catalog.invalidate('projects', 'users')
    await fetchOne(userId)
  }

  return { ...list, search, current, applySearch, fetchOne, create, update, remove, addMembership }
})
