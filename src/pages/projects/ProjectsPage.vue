<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.catalogue') }, { label: t('common.projects') }]"
      :description="t('projects.description')"
      :title="t('common.projects')"
      :with-menu="false"
      @action="dialog.openCreate()"
    />

    <DlExpansion v-model:open="filtersOpen" :panels="filterPanels">
      <template #filters>
        <div class="toolbar">
          <DlTextField
            icon="mdi-magnify"
            :label="t('common.name')"
            :model-value="search"
            :placeholder="t('projects.filters.namePlaceholder')"
            :reserve-error="false"
            @update:model-value="value => { search = asText(value); page = 1 }"
          />

          <DlSelect
            :label="t('common.status')"
            :model-value="statuses"
            multiple
            :options="statusOptions"
            :placeholder="t('projects.filters.anyStatus')"
            @update:model-value="value => { statuses = asOptions(value); page = 1 }"
          />

          <DlRange
            v-model="members"
            :hint="t('projects.filters.membersHint')"
            :label="t('common.members')"
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
      :title="t('common.projectsLoadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="reload">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="hasFilters ? t('projects.emptyFiltered') : t('projects.emptyDescription')"
      :empty-title="t('projects.emptyTitle')"
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
          {{ t('projects.new') }}
        </DlButton>
      </template>
    </DlDataTable>

    <DlFormDialog
      v-model="dialog.open"
      :description="dialog.mode === 'create' ? t('projects.createDescription') : t('projects.renameDescription')"
      :dirty="dialog.dirty"
      :error="dialog.error"
      :mode="dialog.mode"
      :submitting="dialog.submitting"
      :title="dialog.mode === 'create' ? t('projects.new') : t('projects.renameTitle')"
      @submit="save"
    >
      <DlTextField
        :error="dialog.attempted && !dialog.form.name.trim() ? t('common.enterName') : null"
        :hint="t('projects.nameHint')"
        :label="t('common.name')"
        :model-value="dialog.form.name"
        :placeholder="t('projects.namePlaceholder')"
        required
        @update:model-value="value => (dialog.form.name = asText(value))"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('projects.deleteTitle')"
      destructive
      :error="removal.error"
      :message="t('projects.deleteMessage')"
      :processing="removal.processing"
      :require-text="removal.target?.name ?? null"
      :title="t('projects.deleteTitle')"
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
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { PAGE_SIZE } from '@/constants/layout'
  import { PROJECT_STATUS } from '@/constants/status'
  import { useCatalogStore } from '@/stores/catalog'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { shortId } from '@/utils/format'
  import { asOptions, asText } from '@/utils/forms'

  /**
   * Projetos sao poucos por natureza, um por aplicacao do ecossistema. A lista
   * inteira vem do catalogo e filtra no navegador, o que permite filtrar por
   * situacao e por membros, coisa que o backend nao oferece.
   */
  const { t, locale } = useI18n()
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
      locale: locale.value,
      overrides: {
        name: { label: t('common.project') },
        status: { label: t('common.status'), width: '150px' },
        members: { label: t('common.members'), width: '110px' },
        clientId: { label: t('common.clientId'), format: row => shortId(String(row.clientId), 12) },
        createdAt: { label: t('common.registered'), width: '150px' },
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

  const statusOptions = computed(() => (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map(status => ({
    title: PROJECT_STATUS[status].label,
    value: status,
  })))

  const hasFilters = computed(() =>
    !!search.value.trim()
    || statuses.value.length > 0
    || members.value[0] > 0
    || members.value[1] < maxMembers.value,
  )

  const filterPanels = computed(() => {
    const parts: string[] = []

    if (search.value.trim()) {
      parts.push(t('projects.filters.nameHas', { term: search.value.trim() }))
    }

    if (statuses.value.length > 0) {
      const labels = statuses.value.map(status => PROJECT_STATUS[status as ProjectStatus]?.label ?? status)

      parts.push(new Intl.ListFormat(locale.value, { type: 'disjunction' }).format(labels))
    }

    if (members.value[0] > 0 || members.value[1] < maxMembers.value) {
      parts.push(t('projects.filters.membersRange', { min: members.value[0], max: members.value[1] }))
    }

    return [{
      key: 'filters',
      title: t('projects.filters.title'),
      icon: 'mdi-filter-variant',
      summary: parts.length > 0 ? parts.join(' · ') : t('projects.filters.none', rows.value.length),
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

  const headerActions = computed<HeaderAction[]>(() => [
    { key: 'create', label: t('projects.new'), icon: 'mdi-plus', method: 'POST', path: '/project' },
  ])

  /** O projeto do proprio SSO nao se renomeia nem se apaga. O servidor recusa; a tela nem oferece. */
  const isSelf = (row: ProjectRow): boolean => row.name === SELF_PROJECT_NAME

  const rowActions = computed<RowAction<ProjectRow>[]>(() => [
    { key: 'rename', label: t('common.rename'), icon: 'mdi-pencil-outline', method: 'PUT', path: '/project/:id', unavailable: isSelf },
    { key: 'delete', label: t('common.delete'), icon: 'mdi-delete-outline', method: 'DELETE', path: '/project/:id', color: 'error', unavailable: isSelf },
  ])

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
      toast.success(t('projects.created'), { description: t('projects.createdDescription') })
      await router.push({ name: 'project', params: { id: result.created.id } })
    } else {
      toast.success(t('projects.renamed'))
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(async row => {
      await projects.remove(row.id)
      await catalog.ensure('projects', true)
    })

    if (ok) {
      toast.success(t('projects.deleted'))
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
