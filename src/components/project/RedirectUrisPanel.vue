<template>
  <DlSectionCard
    :count="rows.length"
    :description="t('redirectUris.description')"
    :padded="rows.length === 0"
    :title="t('redirectUris.title')"
  >
    <template v-if="canAdd" #actions>
      <DlButton icon="mdi-plus" variant="tonal" @click="dialog.openCreate()">{{ t('redirectUris.add') }}</DlButton>
    </template>

    <DlEmptyState
      v-if="rows.length === 0"
      compact
      :description="t('redirectUris.emptyDescription')"
      icon="mdi-link-variant"
      :title="t('redirectUris.emptyTitle')"
    />

    <DlDataTable
      v-else
      :actions="actions"
      bare
      :columns="columns"
      :limit="rows.length + 1"
      :rows="rows"
      @action="onAction"
    />

    <template v-if="isSelf && rows.length > 0" #footer>
      {{ t('redirectUris.selfNote') }}
    </template>
  </DlSectionCard>

  <DlFormDialog
    v-model="dialog.open"
    :description="t('redirectUris.dialogDescription')"
    :dirty="dialog.dirty"
    :error="dialog.error"
    :mode="dialog.mode"
    :submitting="dialog.submitting"
    :title="dialog.mode === 'create' ? t('redirectUris.add') : t('redirectUris.editTitle')"
    @submit="save"
  >
    <DlTextField
      :error="uriError"
      :hint="t('redirectUris.fieldHint')"
      :label="t('redirectUris.field')"
      :model-value="dialog.form.redirectUri"
      mono
      placeholder="https://app.example.com/api/auth/callback"
      required
      type="url"
      @update:model-value="value => (dialog.form.redirectUri = asText(value))"
    />
  </DlFormDialog>

  <DlConfirmDialog
    v-model="removal.open"
    :confirm-label="t('redirectUris.deleteTitle')"
    destructive
    :error="removal.error"
    :message="removalMessage"
    :processing="removal.processing"
    :title="t('redirectUris.deleteTitle')"
    @confirm="remove"
  />
</template>

<script lang="ts" setup>
  import type { ProjectOverview } from '@/types/sso'
  import {
    type Column,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlFormDialog,
    DlSectionCard,
    DlTextField,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { asText, isHttpUrl } from '@/utils/forms'

  const props = defineProps<{ project: ProjectOverview }>()

  const { t } = useI18n()
  const session = useSessionStore()
  const projects = useProjectsStore()

  interface UriRow extends Record<string, unknown> {
    id: string
    redirectUri: string
  }

  const rows = computed<UriRow[]>(() => props.project.redirectUriRecords.map(record => ({ ...record })))

  const columns = computed<Column<UriRow>[]>(() => [{ key: 'redirectUri', label: t('redirectUris.address'), mono: true }])

  const isSelf = computed(() => props.project.name === SELF_PROJECT_NAME)

  const locked = computed(() => isSelf.value && !session.root)

  const canAdd = computed(() => !locked.value && session.can('POST', '/redirecturi'))

  function originOf (uri: string): string | null {
    try {
      return new URL(uri).origin
    } catch {
      return null
    }
  }

  const actions = computed<RowAction<UriRow>[]>(() => (locked.value
    ? []
    : [
      {
        key: 'edit',
        label: t('common.edit'),
        icon: 'mdi-pencil-outline',
        method: 'PUT',
        path: '/redirecturi/:id',
        unavailable: () => isSelf.value,
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: 'mdi-delete-outline',
        method: 'DELETE',
        path: '/redirecturi/:id',
        color: 'error',
        unavailable: row => isSelf.value && (rows.value.length <= 1 || originOf(row.redirectUri) === window.location.origin),
      },
    ]))

  const dialog = useCrudDialog(() => ({ redirectUri: '' }))
  const removal = useConfirm<UriRow>()

  const removalMessage = computed(() => {
    const target = removal.target

    if (!target) {
      return ''
    }

    if (props.project.status === 'ACTIVE' && rows.value.length === 1) {
      return t('redirectUris.deleteOnly', { uri: target.redirectUri, project: props.project.name })
    }

    return t('redirectUris.deleteMessage', { uri: target.redirectUri })
  })

  function onAction (key: string, row: UriRow): void {
    if (key === 'edit') {
      dialog.openEdit(row.id, { redirectUri: row.redirectUri })
    } else if (key === 'delete') {
      removal.ask(row)
    }
  }

  const uriError = computed(() => {
    if (!dialog.attempted) {
      return null
    }

    const value = dialog.form.redirectUri.trim()

    if (!value) {
      return t('redirectUris.enterAddress')
    }

    return isHttpUrl(value) ? null : t('redirectUris.useHttp')
  })

  async function save (): Promise<void> {
    const value = dialog.form.redirectUri.trim()
    const editingId = dialog.mode === 'edit' ? dialog.targetId : null

    const ok = await dialog.submit(isHttpUrl(value), async () => {
      await (editingId
        ? projects.updateRedirectUri(props.project.id, editingId, value)
        : projects.addRedirectUri(props.project.id, value))
    })

    if (ok) {
      toast.success(editingId ? t('redirectUris.updated') : t('redirectUris.added'))
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(target => projects.removeRedirectUri(props.project.id, target.id))

    if (ok) {
      toast.success(t('redirectUris.deleted'))
    }
  }
</script>
