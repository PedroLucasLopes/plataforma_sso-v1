<template>
  <DlSectionCard
    :count="activeCount"
    description="Public halves the SSO uses to verify the application's signed assertions. The private half never comes back to the SSO."
    :padded="!keys.loading && rows.length === 0"
    title="Client keys"
  >
    <template v-if="canRegister || canGenerate" #actions>
      <DlButton
        v-if="canRegister"
        icon="mdi-key-plus"
        variant="outlined"
        @click="registerDialog.openCreate()"
      >
        Register public key
      </DlButton>

      <DlButton
        v-if="canGenerate"
        icon="mdi-key-chain-variant"
        variant="tonal"
        @click="generation.ask(projectId)"
      >
        Generate key pair
      </DlButton>
    </template>

    <DlEmptyState
      v-if="loadError"
      compact
      :description="loadError"
      icon="mdi-cloud-alert-outline"
      title="Keys could not be loaded"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">Try again</DlButton>
    </DlEmptyState>

    <DlEmptyState
      v-else-if="!keys.loading && rows.length === 0"
      compact
      description="The application cannot authenticate to the SSO without an active key."
      icon="mdi-key-variant"
      title="No keys yet"
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
    description="Generated on the application owner's machine. Only the public half is sent; the private half stays with them."
    :dirty="registerDialog.dirty"
    :error="registerDialog.error"
    mode="create"
    submit-label="Register key"
    :submitting="registerDialog.submitting"
    title="Register public key"
    :width="640"
    @submit="register"
  >
    <DlTextField
      :error="pemError"
      hint="RSA, at least 2048 bits, in PEM (SPKI) format."
      label="Public key"
      :model-value="registerDialog.form.publicKeyPem"
      mono
      placeholder="-----BEGIN PUBLIC KEY-----"
      required
      :rows="7"
      @update:model-value="value => (registerDialog.form.publicKeyPem = asText(value))"
    />

    <DlTextField
      hint="Optional. Leave empty for a key without expiry."
      label="Expires on"
      :model-value="registerDialog.form.expiresOn"
      :reserve-error="false"
      type="date"
      @update:model-value="value => (registerDialog.form.expiresOn = asText(value))"
    />
  </DlFormDialog>

  <DlConfirmDialog
    v-model="generation.open"
    confirm-label="Generate key"
    :error="generation.error"
    :message="`The SSO creates the pair, keeps only the public half and shows you the private key once. Hand it to the owner of ${projectName} through a secure channel.`"
    :processing="generation.processing"
    title="Generate a key pair"
    @confirm="generate"
  />

  <DlSecretDialog
    v-model="secretOpen"
    acknowledge-label="I stored this key in a safe place"
    :description="`Private key for ${projectName}. The application loads it from its own environment, as APP_PRIVATE_KEY_BASE64.`"
    label="Private key (base64, PKCS#8)"
    :secret="secret"
    title="Copy the private key now"
    warning="This key is shown once and is not stored in the SSO. If it passes through chat, a ticket, a commit or a CI log, revoke it and generate another."
    @closed="forgetSecret"
  />

  <DlConfirmDialog
    v-model="revocation.open"
    confirm-label="Revoke key"
    destructive
    :error="revocation.error"
    message="Applications signing with this key stop authenticating immediately. A revoked key cannot be restored."
    :processing="revocation.processing"
    :require-text="revocation.target ? String(revocation.target.id).slice(0, 8) : null"
    title="Revoke client key"
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
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
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

  const session = useSessionStore()
  const keys = useClientKeysStore()

  const canRegister = computed(() => session.can('POST', '/clientkey'))
  // Material de chave: no catalogo, so o papel de nivel maximo alcanca.
  const canGenerate = computed(() => session.can('POST', '/clientkey/generate'))

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
      expiresAt: key.expiresAt ? formatDate(key.expiresAt) : 'Never',
    })),
  )

  const activeCount = computed(() => rows.value.filter(row => row.state === 'ACTIVE').length)

  const columns = computed<Column<KeyRow>[]>(() =>
    inferColumns(rows.value, {
      omit: ['id'],
      overrides: {
        keyId: { label: 'Key', mono: true, secondary: false },
        state: { label: 'Status', width: '140px' },
        createdAt: { label: 'Created', width: '150px' },
        expiresAt: { label: 'Expires', width: '140px' },
      },
    }),
  )

  const actions: RowAction<KeyRow>[] = [
    {
      key: 'revoke',
      label: 'Revoke',
      icon: 'mdi-key-remove',
      method: 'DELETE',
      path: '/clientkey/:id',
      color: 'error',
      unavailable: row => row.state === 'REVOKED',
    },
  ]

  /* ------------------------------ registrar ------------------------------ */

  const registerDialog = useCrudDialog(() => ({ publicKeyPem: '', expiresOn: '' }))

  const pemError = computed(() =>
    registerDialog.attempted && !PUBLIC_KEY_PATTERN.test(registerDialog.form.publicKeyPem.trim())
      ? 'Paste the whole key, from -----BEGIN PUBLIC KEY----- to -----END PUBLIC KEY-----.'
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
      toast.success('Public key registered')
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
      toast.success('Client key revoked')
    }
  }
</script>
