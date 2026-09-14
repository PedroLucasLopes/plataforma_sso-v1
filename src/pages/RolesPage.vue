<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: 'Catalogue' }, { label: 'Roles' }]"
      description="A role belongs to one project. What it unlocks is the set of routes granted to it, managed inside each project."
      title="Roles"
      :with-menu="false"
      @action="openCreate"
    />

    <div class="toolbar">
      <DlSelect
        label="Project"
        :model-value="projectFilter"
        :options="projectOptions"
        placeholder="Every project"
        @update:model-value="value => { projectFilter = asOption(value); page = 1 }"
      />

      <DlSelect
        label="Role"
        :model-value="roleFilter"
        :options="allRoleOptions"
        placeholder="Every role"
        @update:model-value="value => { roleFilter = asOption(value); page = 1 }"
      />
    </div>

    <DlEmptyState
      v-if="loadError"
      :description="loadError"
      icon="mdi-cloud-alert-outline"
      title="Roles could not be loaded"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load(true)">Try again</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="projectFilter || roleFilter ? 'No role matches these filters.' : 'Roles are created inside each project, or here.'"
      empty-title="No roles found"
      :limit="pageLimit"
      :loading="catalog.state.roles.loading && !catalog.state.roles.loaded"
      :page="page"
      :rows="pageRows"
      @action="onRowAction"
      @row-click="openInProject"
      @update:page="value => (page = value)"
    >
      <template #col-name="{ row }">
        <DlStatusChip :map="ROLE_STATUS" :status="String(row.name)" />
      </template>
    </DlDataTable>

    <DlFormDialog
      v-model="createDialog.open"
      description="A project has at most one role of each kind."
      :dirty="createDialog.dirty"
      :error="createDialog.error"
      mode="create"
      :submitting="createDialog.submitting"
      title="New role"
      @submit="saveCreate"
    >
      <DlSelect
        :error="createDialog.attempted && !createDialog.form.projectId ? 'Choose a project.' : null"
        label="Project"
        :model-value="createDialog.form.projectId || null"
        :options="projectOptions"
        required
        @update:model-value="value => { createDialog.form.projectId = asOption(value) ?? ''; createDialog.form.name = '' }"
      />

      <DlSelect
        :disabled="!createDialog.form.projectId"
        :error="createDialog.attempted && !createDialog.form.name ? 'Choose a role.' : null"
        :hint="createDialog.form.projectId && createOptions.length === 0 ? 'This project already has every role.' : undefined"
        label="Role"
        :model-value="createDialog.form.name || null"
        :options="createOptions"
        required
        @update:model-value="value => (createDialog.form.name = (asOption(value) ?? '') as RoleName | '')"
      />
    </DlFormDialog>

    <DlFormDialog
      v-model="renameDialog.open"
      description="Members and permissions stay attached; only the kind of role changes."
      :dirty="renameDialog.dirty"
      :error="renameDialog.error"
      mode="edit"
      :submitting="renameDialog.submitting"
      title="Change role"
      @submit="saveRename"
    >
      <DlSelect
        :clearable="false"
        label="Role"
        :model-value="renameDialog.form.name || null"
        :options="renameOptions"
        required
        @update:model-value="value => (renameDialog.form.name = (asOption(value) ?? '') as RoleName | '')"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="removal.open"
      confirm-label="Delete role"
      destructive
      :error="removal.error"
      :message="removal.target ? `${ROLE_STATUS[removal.target.name]?.label ?? removal.target.name} leaves ${removal.target.project}.` : ''"
      :processing="removal.processing"
      title="Delete role"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { RoleName } from '@/types/sso'
  import {
    type Column,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlFormDialog,
    DlPageHeader,
    DlSelect,
    DlStatusChip,
    type HeaderAction,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { PAGE_SIZE } from '@/constants/layout'
  import { ROLE_NAMES, ROLE_STATUS } from '@/constants/status'
  import { useCatalogStore } from '@/stores/catalog'
  import { useRolesStore } from '@/stores/roles'
  import { useSessionStore } from '@/stores/session'
  import { plural } from '@/utils/format'
  import { asOption } from '@/utils/forms'

  /**
   * Papeis de todos os projetos. O backend nao filtra por projeto, e cada
   * projeto tem no maximo quatro papeis, entao a lista inteira vem do catalogo
   * e filtra no navegador.
   */
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const roles = useRolesStore()

  const loadError = computed(() => (catalog.state.roles.loaded ? null : catalog.state.roles.error))

  function load (force = false): void {
    roles.load(force).catch(() => {})
    catalog.ensure('projects').catch(() => {})
  }

  onMounted(() => load())

  interface RoleRow extends Record<string, unknown> {
    id: string
    name: RoleName
    project: string
    projectId: string
    routes: number
    members: number
  }

  function memberCount (roleId: string): number {
    return catalog.projects.flatMap(project => project.projectUsers ?? []).filter(link => link.roleId === roleId).length
  }

  const rows = computed<RoleRow[]>(() =>
    catalog.roles
      .map(role => ({
        id: role.id,
        name: role.name,
        project: catalog.projectName(role.projectId),
        projectId: role.projectId,
        routes: role.permissions?.length ?? 0,
        members: memberCount(role.id),
      }))
      .toSorted((a, b) => a.project.localeCompare(b.project) || ROLE_NAMES.indexOf(a.name) - ROLE_NAMES.indexOf(b.name)),
  )

  const columns: Column<RoleRow>[] = [
    { key: 'name', label: 'Role', width: '170px' },
    { key: 'project', label: 'Project' },
    { key: 'routes', label: 'Routes granted', width: '150px', align: 'end', format: row => plural(row.routes, 'route') },
    { key: 'members', label: 'Members', width: '120px', align: 'end' },
  ]

  /* -------------------------------- filtros -------------------------------- */

  const projectFilter = ref<string | null>(null)
  const roleFilter = ref<string | null>(null)
  const page = ref(1)

  const projectOptions = computed(() => catalog.projects.map(project => ({ title: project.name, value: project.id })))
  const allRoleOptions = ROLE_NAMES.map(name => ({ title: ROLE_STATUS[name].label, value: name }))

  const filtered = computed(() =>
    rows.value.filter(row =>
      (!projectFilter.value || row.projectId === projectFilter.value)
      && (!roleFilter.value || row.name === roleFilter.value),
    ),
  )

  const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

  const pageLimit = computed(() =>
    filtered.value.length > page.value * PAGE_SIZE ? pageRows.value.length : pageRows.value.length + 1,
  )

  /* -------------------------------- acoes -------------------------------- */

  const headerActions: HeaderAction[] = [
    { key: 'create', label: 'New role', icon: 'mdi-plus', method: 'POST', path: '/role' },
  ]

  /** Papel do proprio SSO so muda pelo bootstrap. O servidor recusa; a tela nem oferece. */
  const isSelf = (row: RoleRow): boolean => row.project === SELF_PROJECT_NAME

  const rowActions: RowAction<RoleRow>[] = [
    { key: 'rename', label: 'Change role', icon: 'mdi-pencil-outline', method: 'PUT', path: '/role/:id', unavailable: isSelf },
    {
      key: 'delete',
      label: 'Delete',
      icon: 'mdi-delete-outline',
      method: 'DELETE',
      path: '/role/:id',
      color: 'error',
      // Permissao e vinculo apontam para o papel. Apagar antes falharia no banco.
      unavailable: row => isSelf(row) || row.routes > 0 || row.members > 0,
    },
  ]

  function namesIn (projectId: string): RoleName[] {
    return catalog.roles.filter(role => role.projectId === projectId).map(role => role.name)
  }

  const createDialog = useCrudDialog(() => ({ projectId: '', name: '' as RoleName | '' }))
  const renameDialog = useCrudDialog(() => ({ projectId: '', name: '' as RoleName | '' }))
  const removal = useConfirm<RoleRow>()

  const createOptions = computed(() =>
    ROLE_NAMES
      .filter(name => !namesIn(createDialog.form.projectId).includes(name))
      .map(name => ({ title: ROLE_STATUS[name].label, value: name })),
  )

  const renameOptions = computed(() => {
    const current = rows.value.find(row => row.id === renameDialog.targetId)
    const taken = new Set(namesIn(renameDialog.form.projectId).filter(name => name !== current?.name))

    return ROLE_NAMES.filter(name => !taken.has(name)).map(name => ({ title: ROLE_STATUS[name].label, value: name }))
  })

  function openCreate (): void {
    createDialog.openCreate({ projectId: projectFilter.value ?? '' })
  }

  function onRowAction (key: string, row: RoleRow): void {
    if (key === 'rename') {
      renameDialog.openEdit(row.id, { projectId: row.projectId, name: row.name })
    } else if (key === 'delete') {
      removal.ask(row)
    }
  }

  function openInProject (row: RoleRow): void {
    if (session.can('GET', `/project/${row.projectId}`)) {
      void router.push({ name: 'project', params: { id: row.projectId }, query: { tab: 'roles' } })
    }
  }

  async function saveCreate (): Promise<void> {
    const { projectId, name } = createDialog.form

    const ok = await createDialog.submit(!!projectId && !!name, async () => {
      if (name) {
        await roles.create({ projectId, name })
      }
    })

    if (ok) {
      toast.success('Role created')
    }
  }

  async function saveRename (): Promise<void> {
    const name = renameDialog.form.name
    const roleId = renameDialog.targetId

    const ok = await renameDialog.submit(!!name && !!roleId, async () => {
      if (name && roleId) {
        await roles.rename(roleId, name)
      }
    })

    if (ok) {
      toast.success('Role changed')
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(row => roles.remove(row.id))

    if (ok) {
      toast.success('Role deleted')
    }
  }
</script>
