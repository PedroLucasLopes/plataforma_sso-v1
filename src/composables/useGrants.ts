import type { HttpMethod, ProjectOverview } from '@/types/sso'
import { toast } from '@pedrolucaslopes/dotlog-ui'
import { computed, type MaybeRefOrGetter, reactive, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
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
  const { t } = useI18n()

  /**
   * Marcar e desmarcar precisa das duas permissoes: criar e apagar permissao.
   * No projeto do proprio SSO, so a raiz: conceder ali e conceder poder
   * administrativo, e o servidor recusa quem nao e ela.
   */
  const canManage = computed(() =>
    (toValue(project).name !== SELF_PROJECT_NAME || session.root)
    && session.can('POST', '/permission')
    && session.can('DELETE', '/permission/:id'),
  )

  const busy = reactive(new Set<string>())

  /** Papeis com uma concessao em lote em andamento. As caixas deles travam juntas. */
  const bulk = reactive(new Set<string>())

  const pairKey = (roleId: string, routeId: string): string => `${roleId}:${routeId}`

  function permissionOf (roleId: string, routeId: string) {
    return toValue(project)
      .roles
      .find(role => role.id === roleId)
      ?.permissions
      .find(permission => permission.routeId === routeId)
  }

  const isBusy = (roleId: string, routeId: string): boolean => bulk.has(roleId) || busy.has(pairKey(roleId, routeId))

  async function toggle (roleId: string, routeId: string, checked: boolean): Promise<void> {
    const key = pairKey(roleId, routeId)
    const existing = permissionOf(roleId, routeId)
    const projectId = toValue(project).id

    if (busy.has(key) || bulk.has(roleId) || checked === !!existing) {
      return
    }

    busy.add(key)

    try {
      await (existing
        ? projects.revokePermission(projectId, existing.id)
        : projects.grant(projectId, roleId, routeId))
    } catch (error) {
      toast.error(checked ? t('grants.grantFailed') : t('grants.revokeFailed'), {
        description: errorMessage(error),
      })
    } finally {
      busy.delete(key)
    }
  }

  /** Rotas do metodo que o papel ainda nao alcanca. */
  function missingOf (roleId: string, method: HttpMethod) {
    return toValue(project).routes.filter(route => route.method === method && !permissionOf(roleId, route.id))
  }

  /**
   * Concede ao papel todas as rotas de um metodo que ele ainda nao tem. E o
   * atalho de quem monta um papel de leitura: um clique no lugar de uma caixa
   * por rota. Devolve quantas foram concedidas.
   */
  async function grantAll (roleId: string, method: HttpMethod): Promise<number> {
    const missing = missingOf(roleId, method)

    if (bulk.has(roleId) || missing.length === 0) {
      return 0
    }

    bulk.add(roleId)

    try {
      return await projects.grantMany(toValue(project).id, roleId, missing.map(route => route.id))
    } catch (error) {
      toast.error(t('grants.bulkFailed', { method }), { description: errorMessage(error) })

      return 0
    } finally {
      bulk.delete(roleId)
    }
  }

  const isBulkBusy = (roleId: string): boolean => bulk.has(roleId)

  return { canManage, permissionOf, isBusy, toggle, missingOf, grantAll, isBulkBusy }
}
