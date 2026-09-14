import type { ProjectOverview } from '@/types/sso'
import { toast } from '@pedrolucaslopes/dotlog-ui'
import { computed, type MaybeRefOrGetter, reactive, toValue } from 'vue'
import { SELF_PROJECT_NAME } from '@/constants/api'
import { errorMessage } from '@/services/http'
import { useProjectsStore } from '@/stores/projects'
import { useSessionStore } from '@/stores/session'

/**
 * Conceder e revogar a permissao de um papel sobre uma rota.
 *
 * Duas telas fazem a mesma coisa por lados opostos: o painel de papeis marca
 * rotas para um papel, e o detalhe da rota marca papeis para ela. A regra mora
 * aqui para as duas nao divergirem.
 *
 * Cada marca e uma chamada. A tela so reflete o que o servidor confirmou: o
 * overview e relido depois, e uma falha deixa a marca como estava.
 */
export function useGrants (project: MaybeRefOrGetter<ProjectOverview>) {
  const session = useSessionStore()
  const projects = useProjectsStore()

  /**
   * Marcar e desmarcar precisa das duas permissoes: criar e apagar permissao.
   * No projeto do proprio SSO, nunca: o catalogo dele so muda pelo bootstrap, e
   * o servidor recusa.
   */
  const canManage = computed(() =>
    toValue(project).name !== SELF_PROJECT_NAME
    && session.can('POST', '/permission')
    && session.can('DELETE', '/permission/:id'),
  )

  const busy = reactive(new Set<string>())

  const pairKey = (roleId: string, routeId: string): string => `${roleId}:${routeId}`

  function permissionOf (roleId: string, routeId: string) {
    return toValue(project)
      .roles
      .find(role => role.id === roleId)
      ?.permissions
      .find(permission => permission.routeId === routeId)
  }

  const isBusy = (roleId: string, routeId: string): boolean => busy.has(pairKey(roleId, routeId))

  async function toggle (roleId: string, routeId: string, checked: boolean): Promise<void> {
    const key = pairKey(roleId, routeId)
    const existing = permissionOf(roleId, routeId)
    const projectId = toValue(project).id

    if (busy.has(key) || checked === !!existing) {
      return
    }

    busy.add(key)

    try {
      await (existing
        ? projects.revokePermission(projectId, existing.id)
        : projects.grant(projectId, roleId, routeId))
    } catch (error) {
      toast.error(checked ? 'The route could not be granted' : 'The permission could not be removed', {
        description: errorMessage(error),
      })
    } finally {
      busy.delete(key)
    }
  }

  return { canManage, permissionOf, isBusy, toggle }
}
