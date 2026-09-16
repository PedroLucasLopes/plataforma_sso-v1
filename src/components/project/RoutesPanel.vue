<template>
  <DlMasterDetail
    :back-label="t('routes.allRoutes')"
    :detail-key="selectedKey"
    :detail-open="!!selectedKey"
    @back="closeDetail"
    @update:narrow="value => (narrow = value)"
  >
    <template #master>
      <DlSectionCard
        :count="project.routes.length"
        :description="t('routes.description')"
        :padded="false"
        :title="t('routes.title')"
      >
        <template v-if="canCreate" #actions>
          <DlButton icon="mdi-plus" variant="tonal" @click="openCreate()">{{ t('routes.add') }}</DlButton>
        </template>

        <div v-if="project.routes.length > 0" class="routes__toolbar">
          <div class="routes__search">
            <DlTextField
              density="compact"
              icon="mdi-magnify"
              :model-value="query"
              :placeholder="t('routes.filterPlaceholder')"
              :reserve-error="false"
              @update:model-value="value => (query = asText(value))"
            />
          </div>

          <VChipGroup
            v-if="presentMethods.length > 1"
            v-model="methods"
            :aria-label="t('routes.filterByMethod')"
            class="routes__methods"
            color="primary"
            multiple
          >
            <VChip
              v-for="method in presentMethods"
              :key="method"
              filter
              size="small"
              :value="method"
              variant="outlined"
            >
              {{ method }}
            </VChip>
          </VChipGroup>

          <div class="routes__tree-actions">
            <VBtn
              :aria-label="t('routes.expandAll')"
              density="comfortable"
              icon="mdi-unfold-more-horizontal"
              size="small"
              :title="t('routes.expandAll')"
              variant="text"
              @click="treeView?.expandAll()"
            />

            <VBtn
              :aria-label="t('routes.collapseAll')"
              density="comfortable"
              icon="mdi-unfold-less-horizontal"
              size="small"
              :title="t('routes.collapseAll')"
              variant="text"
              @click="treeView?.collapseAll()"
            />
          </div>
        </div>

        <DlRouteTree
          ref="treeView"
          :empty-description="t('routes.emptyDescription')"
          :label="t('routes.treeLabel', { project: project.name })"
          :methods="methods"
          :query="query"
          :routes="entries"
          :selected="selectedKey"
          @update:selected="select"
        />

        <template v-if="catalogLocked" #footer>
          {{ t('routes.selfNote') }}
        </template>
      </DlSectionCard>
    </template>

    <template #detail>
      <RouteDetail
        v-if="selectedNode"
        :node="selectedNode"
        :parent-key="parentKey"
        :project="project"
        @create="openCreate"
        @edit="openEdit"
        @remove="target => removal.ask(target)"
        @select="select"
      />

      <div v-else class="routes__panel">
        <DlEmptyState
          compact
          :description="t('routes.notFoundDescription', { path: selectedKey ?? '', project: project.name })"
          icon="mdi-map-marker-question-outline"
          :title="t('routes.notFoundTitle')"
        >
          <DlButton variant="outlined" @click="closeDetail">{{ t('routes.backToRoutes') }}</DlButton>
        </DlEmptyState>
      </div>
    </template>

    <template #placeholder>
      <div class="routes__panel">
        <DlEmptyState
          compact
          :description="t('routes.selectDescription')"
          icon="mdi-gesture-tap"
          :title="t('routes.selectTitle')"
        />
      </div>
    </template>
  </DlMasterDetail>

  <DlFormDialog
    v-model="dialog.open"
    :description="t('routes.dialogDescription')"
    :dirty="dialog.dirty"
    :error="dialog.error"
    :mode="dialog.mode"
    :submitting="dialog.submitting"
    :title="dialog.mode === 'create' ? t('routes.add') : t('routes.editTitle')"
    @submit="save"
  >
    <div class="form-grid">
      <DlSelect
        :clearable="false"
        :label="t('routes.method')"
        :model-value="dialog.form.method"
        :options="HTTP_METHODS"
        required
        @update:model-value="value => (dialog.form.method = (asOption(value) ?? 'GET') as HttpMethod)"
      />

      <DlTextField
        :error="pathError"
        :label="t('routes.path')"
        :model-value="dialog.form.path"
        mono
        placeholder="/equipment/:id"
        required
        @update:model-value="value => (dialog.form.path = asText(value))"
      />
    </div>
  </DlFormDialog>

  <DlConfirmDialog
    v-model="removal.open"
    :confirm-label="t('routes.deleteTitle')"
    destructive
    :error="removal.error"
    :message="removal.target ? t('routes.deleteMessage', { method: removal.target.method, path: removal.target.path }) : ''"
    :processing="removal.processing"
    :title="t('routes.deleteTitle')"
    @confirm="remove"
  />
</template>

<script lang="ts" setup>
  import type { HttpMethod, ProjectOverview } from '@/types/sso'
  import {
    buildRouteTree,
    DlButton,
    DlConfirmDialog,
    DlEmptyState,
    DlFormDialog,
    DlMasterDetail,
    DlRouteTree,
    DlSectionCard,
    DlSelect,
    DlTextField,
    findRouteNode,
    normalizeRoutePath,
    routeAncestorKeys,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import RouteDetail from '@/components/project/RouteDetail.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { HTTP_METHODS } from '@/constants/status'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { queryString } from '@/utils/format'
  import { asOption, asText, ROUTE_PATH_PATTERN } from '@/utils/forms'
  import { type ProjectRoute, routeEntries } from '@/utils/routes'

  /**
   * As rotas do projeto em arvore, com o detalhe do caminho escolhido ao lado.
   *
   * O caminho escolhido mora na URL, em `?route=`: recarregar, voltar ou
   * compartilhar o link abre o mesmo detalhe.
   */
  const props = defineProps<{ project: ProjectOverview }>()

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const projects = useProjectsStore()

  /** O catalogo do proprio SSO so a raiz muda. O servidor recusa os outros; a tela nem oferece. */
  const catalogLocked = computed(() => props.project.name === SELF_PROJECT_NAME && !session.root)

  const canCreate = computed(() => !catalogLocked.value && session.can('POST', '/route'))

  const entries = computed(() => routeEntries(props.project))
  const tree = computed(() => buildRouteTree(entries.value))

  const treeView = ref<{ expandAll: () => void, collapseAll: () => void } | null>(null)

  /* ------------------------------- filtro ------------------------------- */

  const query = ref('')
  const methods = ref<string[]>([])

  const METHOD_ORDER: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'UPDATE', 'DELETE']

  /** So os metodos que o projeto usa. Filtro por metodo que nao existe so esvazia a arvore. */
  const presentMethods = computed(() =>
    METHOD_ORDER.filter(method => props.project.routes.some(item => item.method === method)),
  )

  /* ------------------------------- selecao ------------------------------- */

  const narrow = ref(false)

  const selectedKey = computed(() => {
    const value = queryString(route.query.route)

    return value ? normalizeRoutePath(value) : null
  })

  const selectedNode = computed(() => (selectedKey.value ? findRouteNode(tree.value, selectedKey.value) : null))

  const parentKey = computed(() =>
    selectedKey.value ? (routeAncestorKeys(tree.value, selectedKey.value).at(-1) ?? null) : null,
  )

  /**
   * No estreito o detalhe toma o lugar da arvore, entao abrir entra no
   * historico: o voltar do navegador, ou do telefone, volta para a arvore.
   * Lado a lado, trocar de caminho nao empilha uma entrada por clique.
   */
  let openedWithPush = false

  function select (key: string | null): void {
    if (key === selectedKey.value) {
      return
    }

    const nextQuery = { ...route.query, route: key ?? undefined }

    if (narrow.value && key && !selectedKey.value) {
      openedWithPush = true
      void router.push({ query: nextQuery })

      return
    }

    void router.replace({ query: nextQuery })
  }

  function closeDetail (): void {
    if (openedWithPush && narrow.value) {
      openedWithPush = false
      router.back()

      return
    }

    select(null)
  }

  watch(selectedKey, key => {
    if (!key) {
      openedWithPush = false
    }
  })

  /* ------------------------------ gravacao ------------------------------ */

  const dialog = useCrudDialog(() => ({ method: 'GET' as HttpMethod, path: '' }))
  const removal = useConfirm<ProjectRoute>()

  const pathError = computed(() => {
    if (!dialog.attempted) {
      return null
    }

    return ROUTE_PATH_PATTERN.test(dialog.form.path.trim()) ? null : t('routes.pathError')
  })

  function openCreate (values: { method?: HttpMethod, path?: string } = {}): void {
    dialog.openCreate(values)
  }

  function openEdit (target: ProjectRoute): void {
    dialog.openEdit(target.id, { method: target.method, path: target.path })
  }

  async function save (): Promise<void> {
    const path = dialog.form.path.trim()
    const method = dialog.form.method
    const editingId = dialog.mode === 'edit' ? dialog.targetId : null

    const ok = await dialog.submit(ROUTE_PATH_PATTERN.test(path), async () => {
      await (editingId
        ? projects.updateRoute(props.project.id, editingId, method, path)
        : projects.addRoute(props.project.id, method, path))
    })

    if (ok) {
      toast.success(editingId ? t('routes.updated') : t('routes.added'), { description: `${method} ${path}` })
      // O detalhe acompanha a rota gravada, inclusive quando o caminho mudou.
      select(normalizeRoutePath(path))
    }
  }

  async function remove (): Promise<void> {
    // Guardado antes: se o metodo apagado era o ultimo do caminho, o no some da arvore.
    const fallback = parentKey.value

    const ok = await removal.confirm(target => projects.removeRoute(props.project.id, target.id))

    if (!ok) {
      return
    }

    toast.success(t('routes.deleted'))

    if (!selectedKey.value || findRouteNode(tree.value, selectedKey.value)) {
      return
    }

    if (fallback && findRouteNode(tree.value, fallback)) {
      select(fallback)
    } else {
      closeDetail()
    }
  }
</script>

<style scoped>
.routes__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dl-outline);
}

.routes__search {
  flex: 1 1 200px;
  min-width: 0;
}

.routes__methods {
  flex: 0 1 auto;
  min-width: 0;
}

.routes__tree-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.routes__panel {
  background: var(--dl-surface);
  border: 1px solid var(--dl-outline);
  border-radius: var(--dl-radius-lg, 16px);
}
</style>
