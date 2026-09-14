<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: 'Catalogue' }, { label: 'Projects' }]"
      description="Applications connected to the SSO. A project starts pending and only uses the SSO after an administrator activates it."
      title="Projects"
      :with-menu="false"
      @action="dialog.openCreate()"
    />

    <DlExpansion v-model:open="filtersOpen" :panels="filterPanels">
      <template #filters>
        <div class="toolbar">
          <DlTextField
            icon="mdi-magnify"
            label="Name"
            :model-value="search"
            placeholder="Search by name"
            :reserve-error="false"
            @update:model-value="value => { search = asText(value); page = 1 }"
          />

          <DlSelect
            label="Status"
            :model-value="statuses"
            multiple
            :options="statusOptions"
            placeholder="Any status"
            @update:model-value="value => { statuses = asOptions(value); page = 1 }"
          />

          <DlRange
            v-model="members"
            hint="Filters the projects already loaded."
            label="Members"
            :max="maxMembers"
            :min="0"
            slider-only
            @update:model-value="page = 1"
          />
        </div>
      </template>
    </DlExpansion>

    <DlEmptyState
      v-if="catalog.state.projects.error && !catalog.state.projects.loaded"
      :description="catalog.state.projects.error"
      icon="mdi-cloud-alert-outline"
      title="Projects could not be loaded"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="reload">Try again</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="hasFilters ? 'No project matches these filters.' : 'Register the first application that will sign people in through the SSO.'"
      empty-title="No projects found"
      :limit="pageLimit"
      :loading="catalog.state.projects.loading && !catalog.state.projects.loaded"
      :page="page"
      :rows="pageRows"
      @action="onRowAction"
      @row-click="row => router.push({ name: 'project', params: { id: row.id } })"
      @update:page="value => (page = value)"
    >
      <template #col-status="{ row }">
        <DlStatusChip :map="PROJECT_STATUS" :status="String(row.status)" />
      </template>

      <template #empty-action>
        <DlButton
          v-if="!hasFilters && session.can('POST', '/project')"
          icon="mdi-plus"
          variant="tonal"
          @click="dialog.openCreate()"
        >
          New project
        </DlButton>
      </template>
    </DlDataTable>

    <DlFormDialog
      v-model="dialog.open"
      :description="dialog.mode === 'create' ? 'It starts pending. After creating, add a redirect URI and a client key, then activate it.' : 'The name appears on the sign-in screen, as the application people are signing in to.'"
      :dirty="dialog.dirty"
      :error="dialog.error"
      :mode="dialog.mode"
      :submitting="dialog.submitting"
      :title="dialog.mode === 'create' ? 'New project' : 'Rename project'"
      @submit="save"
    >
      <DlTextField
        :error="dialog.attempted && !dialog.form.name.trim() ? 'Enter a name.' : null"
        hint="Unique in the SSO."
        label="Name"
        :model-value="dialog.form.name"
        placeholder="Finance Dashboard"
        required
        @update:model-value="value => (dialog.form.name = asText(value))"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="removal.open"
      confirm-label="Delete project"
      destructive
      :error="removal.error"
      message="The project leaves the catalogue with its identity. The SSO refuses while it still has routes or members."
      :processing="removal.processing"
      :require-text="removal.target?.name ?? null"
      title="Delete project"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Project, ProjectStatus } from '@/types/sso'
  import {
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlExpansion,
    DlFormDialog,
    DlPageHeader,
    DlRange,
    DlSelect,
    DlStatusChip,
    DlTextField,
    type HeaderAction,
    inferColumns,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { PAGE_SIZE } from '@/constants/layout'
  import { PROJECT_STATUS } from '@/constants/status'
  import { useCatalogStore } from '@/stores/catalog'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { plural, shortId } from '@/utils/format'
  import { asOptions, asText } from '@/utils/forms'

  /**
   * Projetos sao poucos por natureza, um por aplicacao do ecossistema. A lista
   * inteira vem do catalogo e filtra no navegador, o que permite filtrar por
   * situacao e por membros, coisa que o backend nao oferece.
   */
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const projects = useProjectsStore()

  interface ProjectRow extends Record<string, unknown> {
    id: string
    name: string
    status: ProjectStatus
    members: number
    clientId: string
    createdAt: string
  }

  const rows = computed<ProjectRow[]>(() =>
    catalog.projects.map(project => ({
      id: project.id,
      name: project.name,
      status: project.status,
      members: project.projectUsers?.length ?? 0,
      clientId: project.clientId,
      createdAt: project.createdAt,
    })),
  )

  /** Colunas descobertas pela resposta, com rotulo ajustado onde o palpite erraria. */
  const columns = computed(() =>
    inferColumns(rows.value, {
      only: ['name', 'status', 'members', 'clientId', 'createdAt'],
      overrides: {
        name: { label: 'Project' },
        status: { label: 'Status', width: '150px' },
        members: { label: 'Members', width: '110px' },
        clientId: { label: 'Client ID', format: row => shortId(String(row.clientId), 12) },
        createdAt: { label: 'Registered', width: '150px' },
      },
    }),
  )

  /* -------------------------------- filtros -------------------------------- */

  const filtersOpen = ref<string[]>([])
  const search = ref('')
  const statuses = ref<string[]>([])
  const page = ref(1)

  const maxMembers = computed(() => Math.max(1, ...rows.value.map(row => row.members)))
  const members = ref<[number, number]>([0, 1])

  // A faixa acompanha o maior projeto conforme os dados chegam.
  watch(maxMembers, max => {
    members.value = [0, max]
  }, { immediate: true })

  const statusOptions = (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map(status => ({
    title: PROJECT_STATUS[status].label,
    value: status,
  }))

  const hasFilters = computed(() =>
    !!search.value.trim()
    || statuses.value.length > 0
    || members.value[0] > 0
    || members.value[1] < maxMembers.value,
  )

  const filterPanels = computed(() => {
    const parts: string[] = []

    if (search.value.trim()) {
      parts.push(`name has "${search.value.trim()}"`)
    }

    if (statuses.value.length > 0) {
      parts.push(statuses.value.map(status => PROJECT_STATUS[status as ProjectStatus]?.label ?? status).join(' or '))
    }

    if (members.value[0] > 0 || members.value[1] < maxMembers.value) {
      parts.push(`${members.value[0]} to ${members.value[1]} members`)
    }

    return [{
      key: 'filters',
      title: 'Filters',
      icon: 'mdi-filter-variant',
      summary: parts.length > 0 ? parts.join(' · ') : `${plural(rows.value.length, 'project')}, no filter`,
    }]
  })

  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()

    return rows.value.filter(row =>
      (!term || row.name.toLowerCase().includes(term))
      && (statuses.value.length === 0 || statuses.value.includes(row.status))
      && row.members >= members.value[0]
      && row.members <= members.value[1],
    )
  })

  const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

  /**
   * A tabela decide "ha proxima" por pagina cheia, porque o backend nao conta.
   * Aqui o total e conhecido: a pagina so conta como cheia quando ha mais.
   */
  const pageLimit = computed(() =>
    filtered.value.length > page.value * PAGE_SIZE ? pageRows.value.length : pageRows.value.length + 1,
  )

  /* -------------------------------- acoes -------------------------------- */

  const headerActions: HeaderAction[] = [
    { key: 'create', label: 'New project', icon: 'mdi-plus', method: 'POST', path: '/project' },
  ]

  /** O projeto do proprio SSO nao se renomeia nem se apaga. O servidor recusa; a tela nem oferece. */
  const isSelf = (row: ProjectRow): boolean => row.name === SELF_PROJECT_NAME

  const rowActions: RowAction<ProjectRow>[] = [
    { key: 'rename', label: 'Rename', icon: 'mdi-pencil-outline', method: 'PUT', path: '/project/:id', unavailable: isSelf },
    { key: 'delete', label: 'Delete', icon: 'mdi-delete-outline', method: 'DELETE', path: '/project/:id', color: 'error', unavailable: isSelf },
  ]

  const dialog = useCrudDialog(() => ({ name: '' }))
  const removal = useConfirm<ProjectRow>()

  function onRowAction (key: string, row: ProjectRow): void {
    if (key === 'rename') {
      dialog.openEdit(row.id, { name: row.name })
    } else if (key === 'delete') {
      removal.ask(row)
    }
  }

  async function save (): Promise<void> {
    const name = dialog.form.name.trim()
    const editingId = dialog.mode === 'edit' ? dialog.targetId : null
    const result: { created: Project | null } = { created: null }

    const ok = await dialog.submit(!!name, async () => {
      if (editingId) {
        await projects.rename(editingId, name)
      } else {
        result.created = await projects.create(name)
      }

      await catalog.ensure('projects', true)
    })

    if (!ok) {
      return
    }

    if (result.created) {
      toast.success('Project created', { description: 'Next: a redirect URI and a client key, then activation.' })
      await router.push({ name: 'project', params: { id: result.created.id } })
    } else {
      toast.success('Project renamed')
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(async row => {
      await projects.remove(row.id)
      await catalog.ensure('projects', true)
    })

    if (ok) {
      toast.success('Project deleted')
    }
  }

  function reload (): void {
    catalog.ensure('projects', true).catch(() => {})
  }

  onMounted(() => {
    // A falha aparece pelo estado do catalogo, no lugar da tabela.
    catalog.ensure('projects').catch(() => {})
  })
</script>
