import type { HttpMethod, Project, ProjectOverview, ProjectStatus, RoleName } from '@/types/sso'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  membersApi,
  permissionsApi,
  projectsApi,
  redirectUrisApi,
  rolesApi,
  routesApi,
} from '@/services/sso'
import { useCatalogStore } from './catalog'

/**
 * Um projeto e tudo o que mora dentro dele: redirect URIs, rotas, papeis,
 * permissoes e membros.
 *
 * Toda escrita relê o `overview` depois de salvar, em vez de remendar o estado
 * local. O overview e a fonte que o backend monta cruzando cinco tabelas;
 * reproduzir essa conta no navegador seria uma segunda verdade para envelhecer.
 */
export const useProjectsStore = defineStore('projects', () => {
  const catalog = useCatalogStore()

  const projects = ref<Record<string, Project>>({})
  const overviews = ref<Record<string, ProjectOverview>>({})

  async function fetchProject (projectId: string): Promise<Project> {
    const project = await projectsApi.get(projectId)

    projects.value[projectId] = project

    return project
  }

  async function fetchOverview (projectId: string): Promise<ProjectOverview> {
    const overview = await projectsApi.overview(projectId)

    overviews.value[projectId] = overview

    return overview
  }

  /** Relê o que a tela mostra. O overview so para quem pode ve-lo. */
  async function refresh (projectId: string, withOverview: boolean): Promise<void> {
    await Promise.all([
      fetchProject(projectId),
      withOverview ? fetchOverview(projectId) : Promise.resolve(),
    ])
  }

  async function create (name: string): Promise<Project> {
    const project = await projectsApi.create({ name })

    catalog.invalidate('projects')

    return project
  }

  async function rename (projectId: string, name: string): Promise<void> {
    await projectsApi.update(projectId, { name })
    catalog.invalidate('projects')
    await fetchProject(projectId)
  }

  async function remove (projectId: string): Promise<void> {
    await projectsApi.remove(projectId)

    delete projects.value[projectId]
    delete overviews.value[projectId]

    catalog.invalidate('projects', 'routes')
  }

  async function setStatus (projectId: string, status: ProjectStatus, withOverview: boolean): Promise<void> {
    await projectsApi.setStatus(projectId, status)
    catalog.invalidate('projects')
    await refresh(projectId, withOverview)
  }

  async function addRedirectUri (projectId: string, redirectUri: string): Promise<void> {
    await redirectUrisApi.create({ projectId, redirectUri })
    await fetchOverview(projectId)
  }

  async function updateRedirectUri (projectId: string, redirectUriId: string, redirectUri: string): Promise<void> {
    await redirectUrisApi.update(redirectUriId, { redirectUri })
    await fetchOverview(projectId)
  }

  async function removeRedirectUri (projectId: string, redirectUriId: string): Promise<void> {
    await redirectUrisApi.remove(redirectUriId)
    await fetchOverview(projectId)
  }

  async function addRoute (projectId: string, method: HttpMethod, path: string): Promise<void> {
    await routesApi.create({ projectId, method, path })
    catalog.invalidate('routes')
    await fetchOverview(projectId)
  }

  async function updateRoute (projectId: string, routeId: string, method: HttpMethod, path: string): Promise<void> {
    await routesApi.update(routeId, { method, path })
    catalog.invalidate('routes')
    await fetchOverview(projectId)
  }

  async function removeRoute (projectId: string, routeId: string): Promise<void> {
    await routesApi.remove(routeId)
    catalog.invalidate('routes')
    await fetchOverview(projectId)
  }

  async function addRole (projectId: string, name: RoleName): Promise<void> {
    await rolesApi.create({ projectId, name })
    await fetchOverview(projectId)
  }

  async function renameRole (projectId: string, roleId: string, name: RoleName): Promise<void> {
    await rolesApi.update(roleId, { name })
    await fetchOverview(projectId)
  }

  async function removeRole (projectId: string, roleId: string): Promise<void> {
    await rolesApi.remove(roleId)
    await fetchOverview(projectId)
  }

  async function grant (projectId: string, roleId: string, routeId: string): Promise<void> {
    await permissionsApi.grant({ roleId, routeId })
    catalog.invalidate('routes')
    await fetchOverview(projectId)
  }

  /**
   * Varias rotas para o mesmo papel, uma chamada por rota, em sequencia. Para
   * na primeira falha, e o overview e relido uma vez so, no fim, inclusive
   * quando algo falha: a tela mostra o que de fato ficou gravado.
   */
  async function grantMany (projectId: string, roleId: string, routeIds: string[]): Promise<number> {
    let granted = 0
    let failure: unknown = null

    for (const routeId of routeIds) {
      try {
        await permissionsApi.grant({ roleId, routeId })
        granted += 1
      } catch (error) {
        failure = error

        break
      }
    }

    catalog.invalidate('routes')
    await fetchOverview(projectId)

    if (failure) {
      throw failure
    }

    return granted
  }

  async function revokePermission (projectId: string, permissionId: string): Promise<void> {
    await permissionsApi.revoke(permissionId)
    catalog.invalidate('routes')
    await fetchOverview(projectId)
  }

  async function addMember (projectId: string, userId: string, roleId: string): Promise<void> {
    await membersApi.add({ projectId, userId, roleId })
    catalog.invalidate('projects', 'users')
    await fetchOverview(projectId)
  }

  async function changeMemberRole (projectId: string, userId: string, roleId: string): Promise<void> {
    await membersApi.changeRole(projectId, userId, roleId)
    catalog.invalidate('projects', 'users')
    await fetchOverview(projectId)
  }

  async function removeMember (projectId: string, userId: string): Promise<void> {
    await membersApi.remove(projectId, userId)
    catalog.invalidate('projects', 'users')
    await fetchOverview(projectId)
  }

  return {
    projects,
    overviews,
    fetchProject,
    fetchOverview,
    refresh,
    create,
    rename,
    remove,
    setStatus,
    addRedirectUri,
    updateRedirectUri,
    removeRedirectUri,
    addRoute,
    updateRoute,
    removeRoute,
    addRole,
    renameRole,
    removeRole,
    grant,
    grantMany,
    revokePermission,
    addMember,
    changeMemberRole,
    removeMember,
  }
})
