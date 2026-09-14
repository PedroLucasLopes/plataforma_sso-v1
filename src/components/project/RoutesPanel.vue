<template>
  <DlMasterDetail
    back-label="All routes"
    :detail-key="selectedKey"
    :detail-open="!!selectedKey"
    @back="closeDetail"
    @update:narrow="value => (narrow = value)"
  >
    <template #master>
      <DlSectionCard
        :count="project.routes.length"
        description="What this application exposes, grouped by path. Pick any path to see its methods and who can call it."
        :padded="false"
        title="Routes"
      >
        <template v-if="canCreate" #actions>
          <DlButton icon="mdi-plus" variant="tonal" @click="openCreate()">Add route</DlButton>
        </template>

        <div v-if="project.routes.length > 0" class="routes__toolbar">
          <div class="routes__search">
            <DlTextField
              density="compact"
              icon="mdi-magnify"
              :model-value="query"
              placeholder="Filter by path"
              :reserve-error="false"
              @update:model-value="value => (query = asText(value))"
            />
          </div>

          <VChipGroup
            v-if="presentMethods.length > 1"
            v-model="methods"
            aria-label="Filter by method"
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
              aria-label="Expand all"
              density="comfortable"
              icon="mdi-unfold-more-horizontal"
              size="small"
              title="Expand all"
              variant="text"
              @click="treeView?.expandAll()"
            />

            <VBtn
              aria-label="Collapse all"
              density="comfortable"
              icon="mdi-unfold-less-horizontal"
              size="small"
              title="Collapse all"
              variant="text"
              @click="treeView?.collapseAll()"
            />
          </div>
        </div>

        <DlRouteTree
          ref="treeView"
          empty-description="Register the routes of the application, then grant them to roles."
          :label="`${project.name} routes`"
          :methods="methods"
          :query="query"
          :routes="entries"
          :selected="selectedKey"
          @update:selected="select"
        />

        <template v-if="catalogLocked" #footer>
          These are the SSO's own routes. They change only through scripts/bootstrap-sso.js, never here.
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
          :description="`${selectedKey} is not in the ${project.name} catalogue. It may have been renamed or deleted.`"
          icon="mdi-map-marker-question-outline"
          title="Route not found"
        >
          <DlButton variant="outlined" @click="closeDetail">Back to routes</DlButton>
        </DlEmptyState>
      </div>
    </template>

    <template #placeholder>
      <div class="routes__panel">
        <DlEmptyState
          compact
          description="Pick any path in the tree to see its methods, the roles that reach it and who can call it."
          icon="mdi-gesture-tap"
          title="Select a route"
        />
      </div>
    </template>
  </DlMasterDetail>

  <DlFormDialog
    v-model="dialog.open"
    description="The path as the application declares it, without the global prefix. Use :name for parameters."
    :dirty="dialog.dirty"
    :error="dialog.error"
    :mode="dialog.mode"
    :submitting="dialog.submitting"
    :title="dialog.mode === 'create' ? 'Add route' : 'Edit route'"
    @submit="save"
  >
    <div class="form-grid">
      <DlSelect
        :clearable="false"
        label="Method"
        :model-value="dialog.form.method"
        :options="HTTP_METHODS"
        required
        @update:model-value="value => (dialog.form.method = (asOption(value) ?? 'GET') as HttpMethod)"
      />

      <DlTextField
        :error="pathError"
        label="Path"
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
    confirm-label="Delete route"
    destructive
    :error="removal.error"
    :message="removal.target ? `${removal.target.method} ${removal.target.path} leaves the catalogue and starts answering 403 to everyone.` : ''"
    :processing="removal.processing"
    title="Delete route"
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

  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const projects = useProjectsStore()

  /** O catalogo do proprio SSO so muda pelo bootstrap. O servidor recusa; a tela nem oferece. */
  const catalogLocked = computed(() => props.project.name === SELF_PROJECT_NAME)

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

    return ROUTE_PATH_PATTERN.test(dialog.form.path.trim()) ? null : 'Start with a slash and leave no spaces, like /equipment/:id.'
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
      toast.success(editingId ? 'Route updated' : 'Route added', { description: `${method} ${path}` })
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

    toast.success('Route deleted')

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
