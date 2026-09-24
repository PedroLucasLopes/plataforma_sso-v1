<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.catalogue') }, { label: t('nav.users') }]"
      :description="t('users.description')"
      :title="t('nav.users')"
      :with-menu="false"
      @action="dialog.openCreate()"
    />

    <div class="toolbar">
      <DlTextField
        :hint="t('users.searchHint')"
        icon="mdi-magnify"
        :label="t('users.search')"
        :model-value="term"
        :placeholder="t('users.searchPlaceholder')"
        :reserve-error="false"
        @update:model-value="onSearch"
      />
    </div>

    <DlEmptyState
      v-if="users.error && !users.loaded"
      :description="users.error"
      icon="mdi-cloud-alert-outline"
      :title="t('users.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="users.load()">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      :actions="rowActions"
      :columns="columns"
      :empty-description="term.trim() ? t('users.emptySearch') : t('users.emptyDescription')"
      :empty-title="t('users.emptyTitle')"
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
      :description="dialog.mode === 'create' ? t('users.registerDescription') : undefined"
      :dirty="dialog.dirty"
      :error="dialog.error"
      :mode="dialog.mode"
      :submitting="dialog.submitting"
      :title="dialog.mode === 'create' ? t('users.register') : t('users.editTitle')"
      @submit="save"
    >
      <DlTextField
        :error="dialog.attempted && !dialog.form.name.trim() ? t('common.enterName') : null"
        :label="t('common.name')"
        :model-value="dialog.form.name"
        :placeholder="t('users.namePlaceholder')"
        required
        @update:model-value="value => (dialog.form.name = asText(value))"
      />

      <DlTextField
        :error="dialog.attempted && !EMAIL_PATTERN.test(dialog.form.email.trim()) ? t('common.enterEmail') : null"
        :hint="t('common.googleEmailHint')"
        :label="t('common.email')"
        :model-value="dialog.form.email"
        :placeholder="t('users.emailPlaceholder')"
        required
        type="email"
        @update:model-value="value => (dialog.form.email = asText(value))"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('users.deleteTitle')"
      destructive
      :error="removal.error"
      :message="removal.target ? t('users.deleteMessage', { name: removal.target.name }) : ''"
      :processing="removal.processing"
      :title="t('users.deleteTitle')"
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
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { FILTER_DEBOUNCE_MS } from '@/constants/layout'
  import { LINK_STATUS, type LinkState } from '@/constants/status'
  import { useUsersStore } from '@/stores/users'
  import { asText, EMAIL_PATTERN } from '@/utils/forms'

  const { t, locale } = useI18n()
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
      locale: locale.value,
      overrides: {
        name: { label: t('common.name') },
        email: { label: t('common.email') },
        googleAccount: { label: t('users.googleAccount'), width: '210px' },
        projects: { label: t('common.projects'), width: '100px' },
      },
    }),
  )

  const headerActions = computed<HeaderAction[]>(() => [
    { key: 'create', label: t('users.register'), icon: 'mdi-account-plus-outline', method: 'POST', path: '/user' },
  ])

  const rowActions = computed<RowAction<UserRow>[]>(() => [
    { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path: '/user/:id' },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: 'mdi-delete-outline',
      method: 'DELETE',
      path: '/user/:id',
      color: 'error',
      unavailable: row => row.projects > 0,
    },
  ])

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
        toast.success(t('users.updated'))
      } else {
        toast.success(t('users.registered'), { description: t('users.registeredDescription') })
      }
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(row => users.remove(row.id))

    if (ok) {
      toast.success(t('users.deleted'))
    }
  }
</script>
