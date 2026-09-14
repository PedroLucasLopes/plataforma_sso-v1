<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: 'Users', to: '/users' }, { label: title }]"
      :description="user?.email"
      :title="title"
      :with-menu="false"
      @action="onAction"
      @navigate="to => router.push(to)"
    />

    <DlSkeleton v-if="loading && !user" height="220px" variant="block" />

    <DlEmptyState
      v-else-if="loadError && !user"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      title="The user could not be loaded"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">Try again</DlButton>
    </DlEmptyState>

    <template v-else-if="user">
      <DlSectionCard description="How this person is identified when signing in." title="Profile">
        <DlDescriptionList :items="profileItems">
          <template #item-googleAccount>
            <DlStatusChip :map="LINK_STATUS" size="default" :status="linkState" />
          </template>
        </DlDescriptionList>
      </DlSectionCard>

      <DlSectionCard
        :count="memberships.length"
        description="Where this person can sign in, and with which role."
        :padded="memberships.length === 0"
        title="Projects"
      >
        <template v-if="canAddMembership" #actions>
          <DlButton icon="mdi-plus" variant="tonal" @click="openMembership">Add to project</DlButton>
        </template>

        <DlEmptyState
          v-if="memberships.length === 0"
          compact
          description="Without a project, this person cannot sign in anywhere."
          icon="mdi-apps"
          title="No projects yet"
        />

        <DlDataTable
          v-else
          bare
          :columns="membershipColumns"
          :limit="memberships.length + 1"
          :rows="memberships"
          @row-click="row => router.push({ name: 'project', params: { id: row.id } })"
        >
          <template #col-role="{ row }">
            <DlStatusChip :map="ROLE_STATUS" :status="String(row.role)" />
          </template>

          <template #col-status="{ row }">
            <DlStatusChip :map="PROJECT_STATUS" :status="String(row.status)" />
          </template>
        </DlDataTable>
      </DlSectionCard>
    </template>

    <DlFormDialog
      v-model="editDialog.open"
      :dirty="editDialog.dirty"
      :error="editDialog.error"
      mode="edit"
      :submitting="editDialog.submitting"
      title="Edit user"
      @submit="saveEdit"
    >
      <DlTextField
        :error="editDialog.attempted && !editDialog.form.name.trim() ? 'Enter a name.' : null"
        label="Name"
        :model-value="editDialog.form.name"
        required
        @update:model-value="value => (editDialog.form.name = asText(value))"
      />

      <DlTextField
        :error="editDialog.attempted && !EMAIL_PATTERN.test(editDialog.form.email.trim()) ? 'Enter a complete e-mail address.' : null"
        hint="The e-mail of the Google account this person signs in with."
        label="E-mail"
        :model-value="editDialog.form.email"
        required
        type="email"
        @update:model-value="value => (editDialog.form.email = asText(value))"
      />
    </DlFormDialog>

    <DlFormDialog
      v-model="membership.open"
      :description="`${title} signs in to the chosen project with the chosen role.`"
      :dirty="membership.dirty"
      :error="membership.error"
      mode="create"
      submit-label="Add to project"
      :submitting="membership.submitting"
      title="Add to project"
      @submit="saveMembership"
    >
      <DlSelect
        :error="membership.attempted && !membership.form.projectId ? 'Choose a project.' : null"
        label="Project"
        :loading="catalog.state.projects.loading"
        :model-value="membership.form.projectId || null"
        :options="projectOptions"
        required
        @update:model-value="value => { membership.form.projectId = asOption(value) ?? ''; membership.form.roleId = '' }"
      />

      <DlSelect
        :disabled="!membership.form.projectId"
        :error="membership.attempted && !membership.form.roleId ? 'Choose a role.' : null"
        :hint="membership.form.projectId && roleOptions.length === 0 ? 'This project has no roles yet.' : undefined"
        label="Role"
        :loading="catalog.state.roles.loading"
        :model-value="membership.form.roleId || null"
        :options="roleOptions"
        required
        @update:model-value="value => (membership.form.roleId = asOption(value) ?? '')"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="unlink.open"
      confirm-label="Unlink account"
      :error="unlink.error"
      message="The next Google sign-in with this e-mail links a new account. Use it when the person changed Google accounts."
      :processing="unlink.processing"
      title="Unlink Google account"
      @confirm="applyUnlink"
    />

    <DlConfirmDialog
      v-model="removal.open"
      confirm-label="Delete user"
      destructive
      :error="removal.error"
      :message="`${title} can no longer sign in. Registering the same e-mail again creates a new user.`"
      :processing="removal.processing"
      title="Delete user"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import {
    type Column,
    type DescriptionItem,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlDescriptionList,
    DlEmptyState,
    DlFormDialog,
    DlPageHeader,
    DlSectionCard,
    DlSelect,
    DlSkeleton,
    DlStatusChip,
    DlTextField,
    type HeaderAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { LINK_STATUS, type LinkState, PROJECT_STATUS, ROLE_STATUS } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useCatalogStore } from '@/stores/catalog'
  import { useSessionStore } from '@/stores/session'
  import { useUsersStore } from '@/stores/users'
  import { asOption, asText, EMAIL_PATTERN } from '@/utils/forms'

  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const users = useUsersStore()

  const userId = computed(() => String(route.params.id))
  const user = computed(() => (users.current?.id === userId.value ? users.current : null))

  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function load (): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      await users.fetchOne(userId.value)
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  const title = computed(() => user.value?.name ?? 'User')
  const linkState = computed<LinkState>(() => (user.value?.authId ? 'LINKED' : 'WAITING'))

  const profileItems = computed<DescriptionItem[]>(() => {
    const current = user.value

    if (!current) {
      return []
    }

    return [
      { key: 'name', label: 'Name', value: current.name },
      { key: 'email', label: 'E-mail', value: current.email, copyable: true },
      {
        key: 'googleAccount',
        label: 'Google account',
        value: linkState.value,
        hint: current.authId
          ? 'Linked on the first sign-in. Another Google account with this e-mail is refused.'
          : 'The first Google sign-in with this e-mail links the account.',
      },
      { key: 'id', label: 'User ID', value: current.id, mono: true, copyable: true },
    ]
  })

  interface MembershipRow extends Record<string, unknown> {
    id: string
    project: string
    role: string
    status: string
  }

  const memberships = computed<MembershipRow[]>(() =>
    (user.value?.projectUsers ?? []).map(link => ({
      id: link.project.id,
      project: link.project.name,
      role: link.role.name ?? '—',
      status: link.project.status,
    })),
  )

  const membershipColumns: Column<MembershipRow>[] = [
    { key: 'project', label: 'Project' },
    { key: 'role', label: 'Role', width: '150px' },
    { key: 'status', label: 'Project status', width: '170px' },
  ]

  const headerActions = computed<HeaderAction[]>(() => {
    const current = user.value

    if (!current) {
      return []
    }

    const path = `/user/${current.id}`
    const actions: HeaderAction[] = [
      { key: 'edit', label: 'Edit', icon: 'mdi-pencil-outline', method: 'PUT', path, variant: 'outlined' },
    ]

    if (current.authId) {
      actions.push({ key: 'unlink', label: 'Unlink Google account', icon: 'mdi-link-variant-off', method: 'PUT', path, variant: 'text' })
    }

    // Com acesso a algum projeto o SSO recusa apagar, e o console nao tem como
    // tirar o vinculo: o botao so criaria um erro garantido.
    if (memberships.value.length === 0) {
      actions.push({ key: 'delete', label: 'Delete', icon: 'mdi-delete-outline', method: 'DELETE', path, color: 'error', variant: 'text' })
    }

    return actions
  })

  const editDialog = useCrudDialog(() => ({ name: '', email: '' }))
  const membership = useCrudDialog(() => ({ projectId: '', roleId: '' }))
  const unlink = useConfirm<string>()
  const removal = useConfirm<string>()

  function onAction (key: string): void {
    const current = user.value

    if (!current) {
      return
    }

    switch (key) {
      case 'edit': {
        editDialog.openEdit(current.id, { name: current.name, email: current.email })

        break
      }
      case 'unlink': {
        unlink.ask(current.id)

        break
      }
      case 'delete': {
        removal.ask(current.id)

        break
      }
    // No default
    }
  }

  async function saveEdit (): Promise<void> {
    const input = { name: editDialog.form.name.trim(), email: editDialog.form.email.trim().toLowerCase() }

    const ok = await editDialog.submit(!!input.name && EMAIL_PATTERN.test(input.email), () => users.update(userId.value, input))

    if (ok) {
      toast.success('User updated')
    }
  }

  /* ------------------------------ projetos ------------------------------ */

  const canAddMembership = computed(() =>
    session.can('POST', '/projectuser') && session.can('GET', '/project') && session.can('GET', '/role'),
  )

  const projectOptions = computed(() =>
    catalog.projects
      .filter(project => !memberships.value.some(row => row.id === project.id))
      .map(project => ({ title: project.name, value: project.id })),
  )

  const roleOptions = computed(() =>
    catalog.roles
      .filter(role => role.projectId === membership.form.projectId)
      .map(role => ({ title: ROLE_STATUS[role.name]?.label ?? role.name, value: role.id })),
  )

  async function openMembership (): Promise<void> {
    membership.openCreate()

    try {
      await Promise.all([catalog.ensure('projects'), catalog.ensure('roles')])
    } catch (error) {
      toast.error('Projects and roles could not be loaded', { description: errorMessage(error) })
    }
  }

  async function saveMembership (): Promise<void> {
    const { projectId, roleId } = membership.form

    const ok = await membership.submit(!!projectId && !!roleId, () => users.addMembership(userId.value, projectId, roleId))

    if (ok) {
      toast.success('Added to project')
    }
  }

  async function applyUnlink (): Promise<void> {
    const ok = await unlink.confirm(id => users.update(id, { authId: null }))

    if (ok) {
      toast.success('Google account unlinked', { description: 'The next Google sign-in with this e-mail links a new account.' })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(id => users.remove(id))

    if (ok) {
      toast.success('User deleted')
      await router.replace({ name: 'users' })
    }
  }
</script>
