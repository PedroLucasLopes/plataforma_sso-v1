<template>
  <DlSectionCard
    :count="rows.length"
    description="Who can sign in to this application, and with which role."
    :padded="rows.length === 0"
    title="Members"
  >
    <template v-if="canAdd" #actions>
      <DlButton
        :disabled="project.roles.length === 0"
        icon="mdi-account-plus-outline"
        variant="tonal"
        @click="openAdd"
      >
        Add member
      </DlButton>
    </template>

    <DlEmptyState
      v-if="rows.length === 0"
      compact
      :description="project.roles.length > 0 ? 'Nobody can sign in to this application yet.' : 'Create a role first. Every member joins with one.'"
      icon="mdi-account-multiple-outline"
      title="No members yet"
    />

    <DlDataTable
      v-else
      bare
      :columns="columns"
      :limit="rows.length + 1"
      :rows="rows"
      @row-click="open"
    >
      <template #col-role="{ row }">
        <DlStatusChip :map="ROLE_STATUS" :status="String(row.role)" />
      </template>
    </DlDataTable>

    <template v-if="rows.length > 0" #footer>
      Changing or removing a membership is not available in the SSO API yet.
    </template>
  </DlSectionCard>

  <DlFormDialog
    v-model="dialog.open"
    :description="`The person signs in to ${project.name} with the role chosen here.`"
    :dirty="dialog.dirty"
    :error="dialog.error"
    mode="create"
    submit-label="Add member"
    :submitting="dialog.submitting"
    title="Add member"
    @submit="save"
  >
    <DlSelect
      :error="dialog.attempted && !dialog.form.userId ? 'Choose a person.' : null"
      hint="Only registered people who are not members yet."
      label="Person"
      :loading="catalog.state.users.loading"
      :model-value="dialog.form.userId || null"
      :options="userOptions"
      required
      searchable
      @update:model-value="value => (dialog.form.userId = asOption(value) ?? '')"
    />

    <DlSelect
      :error="dialog.attempted && !dialog.form.roleId ? 'Choose a role.' : null"
      label="Role"
      :model-value="dialog.form.roleId || null"
      :options="roleOptions"
      required
      @update:model-value="value => (dialog.form.roleId = asOption(value) ?? '')"
    />
  </DlFormDialog>
</template>

<script lang="ts" setup>
  import type { ProjectOverview, RoleName } from '@/types/sso'
  import {
    type Column,
    DlButton,
    DlDataTable,
    DlEmptyState,
    DlFormDialog,
    DlSectionCard,
    DlSelect,
    DlStatusChip,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { ROLE_STATUS } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useCatalogStore } from '@/stores/catalog'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { plural } from '@/utils/format'
  import { asOption } from '@/utils/forms'

  const props = defineProps<{ project: ProjectOverview }>()

  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const projects = useProjectsStore()

  const canAdd = computed(() => session.can('POST', '/projectuser') && session.can('GET', '/user'))

  interface MemberRow extends Record<string, unknown> {
    id: string
    name: string
    email: string
    role: RoleName
    routes: string
  }

  const rows = computed<MemberRow[]>(() =>
    props.project.users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      routes: plural(user.grantedRoutes, 'route'),
    })),
  )

  const columns: Column<MemberRow>[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'E-mail', secondary: true },
    { key: 'role', label: 'Role', width: '150px' },
    { key: 'routes', label: 'Granted', width: '120px', align: 'end' },
  ]

  const userOptions = computed(() =>
    catalog.users
      .filter(user => !props.project.users.some(member => member.id === user.id))
      .map(user => ({ title: `${user.name} · ${user.email}`, value: user.id })),
  )

  const roleOptions = computed(() =>
    props.project.roles.map(role => ({ title: ROLE_STATUS[role.name]?.label ?? role.name, value: role.id })),
  )

  const dialog = useCrudDialog(() => ({ userId: '', roleId: '' }))

  async function openAdd (): Promise<void> {
    dialog.openCreate()

    try {
      await catalog.ensure('users')
    } catch (error) {
      toast.error('The list of people could not be loaded', { description: errorMessage(error) })
    }
  }

  async function save (): Promise<void> {
    const { userId, roleId } = dialog.form

    const ok = await dialog.submit(!!userId && !!roleId, () => projects.addMember(props.project.id, userId, roleId))

    if (ok) {
      toast.success('Member added')
    }
  }

  function open (row: MemberRow): void {
    if (session.can('GET', `/user/${row.id}`)) {
      void router.push({ name: 'user', params: { id: row.id } })
    }
  }
</script>
