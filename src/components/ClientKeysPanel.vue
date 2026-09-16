<template>
  <DlSectionCard
    :count="activeCount"
    :description="t('clientKeys.description')"
    :padded="!keys.loading && rows.length === 0"
    :title="t('clientKeys.title')"
  >
    <template v-if="canRegister || canGenerate" #actions>
      <DlButton
        v-if="canRegister"
        icon="mdi-key-plus"
        variant="outlined"
        @click="registerDialog.openCreate()"
      >
        {{ t('clientKeys.registerPublic') }}
      </DlButton>

      <DlButton
        v-if="canGenerate"
        icon="mdi-key-chain-variant"
        variant="tonal"
        @click="generation.ask(projectId)"
      >
        {{ t('clientKeys.generatePair') }}
      </DlButton>
    </template>

    <DlEmptyState
      v-if="loadError"
      compact
      :description="loadError"
      icon="mdi-cloud-alert-outline"
      :title="t('clientKeys.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlEmptyState
      v-else-if="!keys.loading && rows.length === 0"
      compact
      :description="t('clientKeys.emptyDescription')"
      icon="mdi-key-variant"
      :title="t('clientKeys.emptyTitle')"
    />

    <DlDataTable
      v-else
      :actions="actions"
      bare
      :columns="columns"
      :limit="rows.length + 1"
      :loading="keys.loading && rows.length === 0"
      :rows="rows"
      @action="(_key, row) => revocation.ask(row)"
    >
      <template #col-state="{ row }">
        <DlStatusChip :map="KEY_STATUS" :status="String(row.state)" />
      </template>
    </DlDataTable>
  </DlSectionCard>

  <DlFormDialog
    v-model="registerDialog.open"
    :description="t('clientKeys.registerDescription')"
    :dirty="registerDialog.dirty"
    :error="registerDialog.error"
    mode="create"
    :submit-label="t('clientKeys.registerKey')"
    :submitting="registerDialog.submitting"
    :title="t('clientKeys.registerPublic')"
    :width="640"
    @submit="register"
  >
    <DlTextField
      :error="pemError"
      :hint="t('clientKeys.publicKeyHint')"
      :label="t('clientKeys.publicKey')"
      :model-value="registerDialog.form.publicKeyPem"
      mono
      placeholder="-----BEGIN PUBLIC KEY-----"
      required
      :rows="7"
      @update:model-value="value => (registerDialog.form.publicKeyPem = asText(value))"
    />

    <DlTextField
      :hint="t('clientKeys.expiresHint')"
      :label="t('clientKeys.expiresOn')"
      :model-value="registerDialog.form.expiresOn"
      :reserve-error="false"
      type="date"
      @update:model-value="value => (registerDialog.form.expiresOn = asText(value))"
    />
  </DlFormDialog>

  <DlConfirmDialog
    v-model="generation.open"
    :confirm-label="t('clientKeys.generateKey')"
    :error="generation.error"
    :message="t('clientKeys.generateMessage', { project: projectName })"
    :processing="generation.processing"
    :title="t('clientKeys.generateTitle')"
    @confirm="generate"
  />

  <DlSecretDialog
    v-model="secretOpen"
    :acknowledge-label="t('clientKeys.secretAcknowledge')"
    :description="t('clientKeys.secretDescription', { project: projectName })"
    :label="t('clientKeys.secretLabel')"
    :secret="secret"
    :title="t('clientKeys.secretTitle')"
    :warning="t('clientKeys.secretWarning')"
    @closed="forgetSecret"
  />

  <DlConfirmDialog
    v-model="revocation.open"
    :confirm-label="t('clientKeys.revokeKey')"
    destructive
    :error="revocation.error"
    :message="t('clientKeys.revokeMessage')"
    :processing="revocation.processing"
    :require-text="revocation.target ? String(revocation.target.id).slice(0, 8) : null"
    :title="t('clientKeys.revokeTitle')"
    @confirm="revoke"
  />
</template>

<script lang="ts" setup>
  import {
    type Column,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlFormDialog,
    DlSecretDialog,
    DlSectionCard,
    DlStatusChip,
    DlTextField,
    inferColumns,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { KEY_STATUS, type KeyState } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useClientKeysStore } from '@/stores/clientKeys'
  import { useSessionStore } from '@/stores/session'
  import { formatDate, keyState, shortId } from '@/utils/format'
  import { asText, PUBLIC_KEY_PATTERN } from '@/utils/forms'

  const props = defineProps<{
    projectId: string
    projectName: string
  }>()

  const { t, locale } = useI18n()
  const session = useSessionStore()
  const keys = useClientKeysStore()

  /** Chave do projeto `SSO` autentica o proprio SSO como cliente: so a raiz mexe nela. */
  const locked = computed(() => props.projectName === SELF_PROJECT_NAME && !session.root)

  const canRegister = computed(() => !locked.value && session.can('POST', '/clientkey'))
  // Material de chave: quem alcanca e o que o catalogo concede ao papel.
  const canGenerate = computed(() => !locked.value && session.can('POST', '/clientkey/generate'))

  const loadError = ref<string | null>(null)

  async function load (): Promise<void> {
    loadError.value = null

    try {
      await keys.load(props.projectId)
    } catch (error) {
      loadError.value = errorMessage(error)
    }
  }

  watch(() => props.projectId, load, { immediate: true })

  interface KeyRow extends Record<string, unknown> {
    id: string
    keyId: string
    state: KeyState
    createdAt: string
    expiresAt: string
  }

  const rows = computed<KeyRow[]>(() =>
    (keys.byProject[props.projectId] ?? []).map(key => ({
      id: key.id,
      keyId: shortId(key.id, 13),
      state: keyState(key),
      createdAt: key.createdAt,
      expiresAt: key.expiresAt ? formatDate(key.expiresAt) : t('common.never'),
    })),
  )

  const activeCount = computed(() => rows.value.filter(row => row.state === 'ACTIVE').length)

  const columns = computed<Column<KeyRow>[]>(() =>
    inferColumns(rows.value, {
      omit: ['id'],
      locale: locale.value,
      overrides: {
        keyId: { label: t('clientKeys.columns.key'), mono: true, secondary: false },
        state: { label: t('common.status'), width: '140px' },
        createdAt: { label: t('clientKeys.columns.created'), width: '150px' },
        expiresAt: { label: t('clientKeys.columns.expires'), width: '140px' },
      },
    }),
  )

  const actions = computed<RowAction<KeyRow>[]>(() => (locked.value
    ? []
    : [
      {
        key: 'revoke',
        label: t('clientKeys.revoke'),
        icon: 'mdi-key-remove',
        method: 'DELETE',
        path: '/clientkey/:id',
        color: 'error',
        unavailable: row => row.state === 'REVOKED',
      },
    ]))

  /* ------------------------------ registrar ------------------------------ */

  const registerDialog = useCrudDialog(() => ({ publicKeyPem: '', expiresOn: '' }))

  const pemError = computed(() =>
    registerDialog.attempted && !PUBLIC_KEY_PATTERN.test(registerDialog.form.publicKeyPem.trim())
      ? t('clientKeys.pemError')
      : null,
  )

  async function register (): Promise<void> {
    const pem = registerDialog.form.publicKeyPem.trim()
    // Fim do dia escolhido, no fuso de quem cadastra.
    const expiresAt = registerDialog.form.expiresOn
      ? new Date(`${registerDialog.form.expiresOn}T23:59:59`).toISOString()
      : undefined

    const ok = await registerDialog.submit(PUBLIC_KEY_PATTERN.test(pem), () => keys.register(props.projectId, `${pem}\n`, expiresAt))

    if (ok) {
      toast.success(t('clientKeys.registered'))
    }
  }

  /* -------------------------------- gerar -------------------------------- */

  const generation = useConfirm<string>()

  /**
   * A chave privada vive so aqui, num ref local, pelo tempo em que o dialogo
   * esta aberto. Nao vai para store, log nem armazenamento, e some ao fechar.
   */
  const secret = ref('')
  const secretOpen = ref(false)

  async function generate (): Promise<void> {
    await generation.confirm(async projectId => {
      const generated = await keys.generate(projectId)

      secret.value = generated.privateKeyBase64
      secretOpen.value = true
    })
  }

  function forgetSecret (): void {
    secret.value = ''
  }

  /* ------------------------------- revogar ------------------------------- */

  const revocation = useConfirm<KeyRow>()

  async function revoke (): Promise<void> {
    const ok = await revocation.confirm(row => keys.revoke(props.projectId, row.id))

    if (ok) {
      toast.success(t('clientKeys.revoked'))
    }
  }
</script>
