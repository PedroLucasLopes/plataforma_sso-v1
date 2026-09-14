<template>
  <DlSectionCard
    :count="rows.length"
    description="The SSO only returns a sign-in to these addresses, compared character by character. Register each environment separately."
    :padded="rows.length === 0"
    title="Redirect URIs"
  >
    <template v-if="session.can('POST', '/redirecturi')" #actions>
      <DlButton icon="mdi-plus" variant="tonal" @click="dialog.openCreate()">Add redirect URI</DlButton>
    </template>

    <DlEmptyState
      v-if="rows.length === 0"
      compact
      description="Without one, no application can complete a sign-in with this project."
      icon="mdi-link-variant"
      title="No redirect URIs yet"
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
      This console signs in through these addresses, so they are never edited: add the new address, then delete
      the old one. The last address, and the one this console is using now, cannot be deleted.
    </template>
  </DlSectionCard>

  <DlFormDialog
    v-model="dialog.open"
    description="Scheme, host, port and path, exactly as the application sends it. A trailing slash makes it a different address."
    :dirty="dialog.dirty"
    :error="dialog.error"
    :mode="dialog.mode"
    :submitting="dialog.submitting"
    :title="dialog.mode === 'create' ? 'Add redirect URI' : 'Edit redirect URI'"
    @submit="save"
  >
    <DlTextField
      :error="uriError"
      hint="Example: https://app.example.com/api/auth/callback"
      label="Redirect URI"
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
    confirm-label="Delete redirect URI"
    destructive
    :error="removal.error"
    :message="removalMessage"
    :processing="removal.processing"
    title="Delete redirect URI"
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
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { asText, isHttpUrl } from '@/utils/forms'

  const props = defineProps<{ project: ProjectOverview }>()

  const session = useSessionStore()
  const projects = useProjectsStore()

  interface UriRow extends Record<string, unknown> {
    id: string
    redirectUri: string
  }

  const rows = computed<UriRow[]>(() => props.project.redirectUriRecords.map(record => ({ ...record })))

  const columns: Column<UriRow>[] = [{ key: 'redirectUri', label: 'Address', mono: true }]

  /**
   * No projeto do proprio SSO estas URIs sao por onde o console entra. O servidor
   * recusa editar qualquer uma, apagar a ultima e apagar a da origem de onde o
   * pedido sai; a tela so deixa de oferecer o que seria recusado.
   */
  const isSelf = computed(() => props.project.name === SELF_PROJECT_NAME)

  function originOf (uri: string): string | null {
    try {
      return new URL(uri).origin
    } catch {
      return null
    }
  }

  const actions: RowAction<UriRow>[] = [
    {
      key: 'edit',
      label: 'Edit',
      icon: 'mdi-pencil-outline',
      method: 'PUT',
      path: '/redirecturi/:id',
      unavailable: () => isSelf.value,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: 'mdi-delete-outline',
      method: 'DELETE',
      path: '/redirecturi/:id',
      color: 'error',
      unavailable: row => isSelf.value && (rows.value.length <= 1 || originOf(row.redirectUri) === window.location.origin),
    },
  ]

  const dialog = useCrudDialog(() => ({ redirectUri: '' }))
  const removal = useConfirm<UriRow>()

  const removalMessage = computed(() => {
    const target = removal.target

    if (!target) {
      return ''
    }

    if (props.project.status === 'ACTIVE' && rows.value.length === 1) {
      return `${target.redirectUri} is the only address of ${props.project.name}. Until another one is added, nobody can sign in to it.`
    }

    return `Applications that still send ${target.redirectUri} stop signing in, and codes already issued to it are refused.`
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
      return 'Enter the address.'
    }

    return isHttpUrl(value) ? null : 'Use a full http or https address.'
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
      toast.success(editingId ? 'Redirect URI updated' : 'Redirect URI added')
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(target => projects.removeRedirectUri(props.project.id, target.id))

    if (ok) {
      toast.success('Redirect URI deleted')
    }
  }
</script>
