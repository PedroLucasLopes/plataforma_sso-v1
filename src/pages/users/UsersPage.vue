<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: 'Catalogue' }, { label: 'Users' }]"
      description="People who can sign in through the SSO. Nobody signs in without being registered here first."
      title="Users"
      :with-menu="false"
      @action="dialog.openCreate()"
    />

    <div class="toolbar">
      <DlTextField
        hint="Part of a name, or a complete e-mail address."
        icon="mdi-magnify"
        label="Search"
        :model-value="term"
        placeholder="Marina, or marina@example.com"
        :reserve-error="false"
        @update:model-value="onSearch"
      />
    </div>

    <DlEmptyState
      v-if="users.error && !users.loaded"
      :description="users.error"
      icon="mdi-cloud-alert-outline"
      title="Users could not be loaded"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="users.load()">Try again</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="term.trim() ? 'No user matches this search.' : 'Register the first person who will sign in through the SSO.'"
      empty-title="No users found"
      :limit="users.limit"
      :loading="users.loading && !users.loaded"
      :page="users.page"
      :rows="rows"
      @action="onRowAction"
      @row-click="row => router.push({ name: 'user', params: { id: row.id } })"
      @update:page="value => users.setPage(value)"
    >
      <template #col-googleAccount="{ row }">
        <DlStatusChip :map="LINK_STATUS" :status="String(row.googleAccount)" />
      </template>
    </DlDataTable>

    <DlFormDialog
      v-model="dialog.open"
      :description="dialog.mode === 'create' ? 'Registering does not grant access yet. Add the person to a project afterwards.' : undefined"
      :dirty="dialog.dirty"
      :error="dialog.error"
      :mode="dialog.mode"
      :submitting="dialog.submitting"
      :title="dialog.mode === 'create' ? 'Register user' : 'Edit user'"
      @submit="save"
    >
      <DlTextField
        :error="dialog.attempted && !dialog.form.name.trim() ? 'Enter a name.' : null"
        label="Name"
        :model-value="dialog.form.name"
        placeholder="Marina Albuquerque"
        required
        @update:model-value="value => (dialog.form.name = asText(value))"
      />

      <DlTextField
        :error="dialog.attempted && !EMAIL_PATTERN.test(dialog.form.email.trim()) ? 'Enter a complete e-mail address.' : null"
        hint="The e-mail of the Google account this person signs in with."
        label="E-mail"
        :model-value="dialog.form.email"
        placeholder="marina@example.com"
        required
        type="email"
        @update:model-value="value => (dialog.form.email = asText(value))"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="removal.open"
      confirm-label="Delete user"
      destructive
      :error="removal.error"
      :message="removal.target ? `${removal.target.name} can no longer sign in. Registering the same e-mail again creates a new user.` : ''"
      :processing="removal.processing"
      title="Delete user"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import {
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlFormDialog,
    DlPageHeader,
    DlStatusChip,
    DlTextField,
    type HeaderAction,
    inferColumns,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { FILTER_DEBOUNCE_MS } from '@/constants/layout'
  import { LINK_STATUS, type LinkState } from '@/constants/status'
  import { useUsersStore } from '@/stores/users'
  import { asText, EMAIL_PATTERN } from '@/utils/forms'

  /** Pessoas cadastradas. Lista que cresce com o uso, entao pagina no servidor. */
  const router = useRouter()
  const users = useUsersStore()

  interface UserRow extends Record<string, unknown> {
    id: string
    name: string
    email: string
    googleAccount: LinkState
    projects: number
  }

  const rows = computed<UserRow[]>(() =>
    users.rows.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      googleAccount: user.authId ? 'LINKED' : 'WAITING',
      projects: user.projectUsers?.length ?? 0,
    })),
  )

  const columns = computed(() =>
    inferColumns(rows.value, {
      omit: ['id'],
      overrides: {
        name: { label: 'Name' },
        email: { label: 'E-mail' },
        googleAccount: { label: 'Google account', width: '210px' },
        projects: { label: 'Projects', width: '100px' },
      },
    }),
  )

  const headerActions: HeaderAction[] = [
    { key: 'create', label: 'Register user', icon: 'mdi-account-plus-outline', method: 'POST', path: '/user' },
  ]

  const rowActions: RowAction<UserRow>[] = [
    { key: 'edit', label: 'Edit', icon: 'mdi-pencil-outline', method: 'PUT', path: '/user/:id' },
    {
      key: 'delete',
      label: 'Delete',
      icon: 'mdi-delete-outline',
      method: 'DELETE',
      path: '/user/:id',
      color: 'error',
      // O SSO recusa apagar quem ainda tem acesso a algum projeto.
      unavailable: row => row.projects > 0,
    },
  ]

  /* -------------------------------- busca -------------------------------- */

  const term = ref(users.search)

  let timer: ReturnType<typeof setTimeout> | undefined

  function onSearch (value: unknown): void {
    term.value = asText(value)
    clearTimeout(timer)
    timer = setTimeout(() => {
      void users.applySearch(term.value)
    }, FILTER_DEBOUNCE_MS)
  }

  onBeforeUnmount(() => clearTimeout(timer))

  onMounted(() => {
    void users.load()
  })

  /* ------------------------------ gravacao ------------------------------ */

  const dialog = useCrudDialog(() => ({ name: '', email: '' }))
  const removal = useConfirm<UserRow>()

  function onRowAction (key: string, row: UserRow): void {
    if (key === 'edit') {
      dialog.openEdit(row.id, { name: row.name, email: row.email })
    } else if (key === 'delete') {
      removal.ask(row)
    }
  }

  async function save (): Promise<void> {
    const input = { name: dialog.form.name.trim(), email: dialog.form.email.trim().toLowerCase() }
    const editingId = dialog.mode === 'edit' ? dialog.targetId : null

    const ok = await dialog.submit(!!input.name && EMAIL_PATTERN.test(input.email), async () => {
      await (editingId ? users.update(editingId, input) : users.create(input))
    })

    if (ok) {
      if (editingId) {
        toast.success('User updated')
      } else {
        toast.success('User registered', { description: 'They can sign in once added to a project.' })
      }
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(row => users.remove(row.id))

    if (ok) {
      toast.success('User deleted')
    }
  }
</script>
