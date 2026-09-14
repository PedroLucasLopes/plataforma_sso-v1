import type { RoleInput, RoleName } from '@/types/sso'
import { defineStore } from 'pinia'
import { rolesApi } from '@/services/sso'
import { useCatalogStore } from './catalog'

/**
 * Papeis de todos os projetos.
 *
 * A lista vem do catalogo e filtra no navegador: cada projeto tem no maximo
 * um papel de cada tipo, entao o total cresce devagar, e o backend nao filtra
 * por projeto.
 */
export const useRolesStore = defineStore('roles', () => {
  const catalog = useCatalogStore()

  function load (force = false): Promise<void> {
    return catalog.ensure('roles', force)
  }

  async function create (input: RoleInput): Promise<void> {
    await rolesApi.create(input)
    await load(true)
  }

  async function rename (roleId: string, name: RoleName): Promise<void> {
    await rolesApi.update(roleId, { name })
    await load(true)
  }

  async function remove (roleId: string): Promise<void> {
    await rolesApi.remove(roleId)
    await load(true)
  }

  return { load, create, rename, remove }
})
