<template>
  <DlSectionCard :description="t('user.credential.description')" :title="t('user.credential.title')">
    <template #actions>
      <DlButton
        v-if="canIssue"
        icon="mdi-key-variant"
        :loading="busy === 'issue'"
        variant="tonal"
        @click="issue"
      >
        {{ credential?.password.issued ? t('user.credential.reissue') : t('user.credential.issue') }}
      </DlButton>
    </template>

    <DlDescriptionList :items="items">
      <template #item-password>
        <DlStatusChip :map="CREDENTIAL_STATUS" size="default" :status="passwordState" />
      </template>

      <template #item-mfa>
        <DlStatusChip :map="CREDENTIAL_STATUS" size="default" :status="mfaState" />
      </template>
    </DlDescriptionList>

    <div v-if="canIssue" class="credential-actions">
      <DlButton
        v-if="credential?.password.issued"
        icon="mdi-key-remove"
        :loading="busy === 'revoke'"
        size="small"
        variant="text"
        @click="revoke"
      >
        {{ t('user.credential.revoke') }}
      </DlButton>

      <DlButton
        v-if="credential?.mfa.enrolled"
        icon="mdi-cellphone-remove"
        :loading="busy === 'mfa'"
        size="small"
        variant="text"
        @click="resetMfa"
      >
        {{ t('user.credential.resetMfa') }}
      </DlButton>
    </div>
  </DlSectionCard>

  <DlSecretDialog
    :copy-label="t('user.credential.copy')"
    :description="t('user.credential.issuedDescription')"
    :model-value="!!issued"
    :secret="issued ?? ''"
    :title="t('user.credential.issuedTitle')"
    @update:model-value="issued = null"
  />
</template>

<script lang="ts" setup>
  import type { UserCredentialView } from '@/types/sso'
  import {
    type DescriptionItem,
    DlButton,
    DlDescriptionList,
    DlSecretDialog,
    DlSectionCard,
    DlStatusChip,
    toast,
    usePermissions,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { CREDENTIAL_STATUS } from '@/constants/status'
  import { usersApi } from '@/services/sso'
  import { formatDateTime } from '@/utils/format'

  const props = defineProps<{ userId: string }>()

  const { t } = useI18n()
  const { canCreate } = usePermissions()

  const credential = ref<UserCredentialView | null>(null)
  const issued = ref<string | null>(null)
  const busy = ref<'issue' | 'revoke' | 'mfa' | null>(null)

  const canIssue = computed(() => canCreate('/user/:id/password'))

  const passwordState = computed(() => {
    if (!credential.value?.password.issued) {
      return 'NONE'
    }

    if (credential.value.password.lockedUntil) {
      return 'LOCKED'
    }

    return credential.value.password.mustChange ? 'PENDING' : 'READY'
  })

  const mfaState = computed(() => (credential.value?.mfa.enrolled ? 'READY' : 'NONE'))

  const items = computed<DescriptionItem[]>(() => {
    const current = credential.value

    if (!current) {
      return []
    }

    return [
      {
        key: 'password',
        label: t('user.credential.password'),
        value: passwordState.value,
        hint: current.password.lockedUntil
          ? t('user.credential.lockedHint', { until: formatDateTime(current.password.lockedUntil) })
          : (current.password.mustChange && current.password.issued
            ? t('user.credential.pendingHint')
            : undefined),
      },
      {
        key: 'mfa',
        label: t('user.credential.mfa'),
        value: mfaState.value,
        hint: current.mfa.enrolled
          ? t('user.credential.recoveryLeft', { count: current.mfa.recoveryCodesLeft })
          : t('user.credential.mfaPendingHint'),
      },
    ]
  })

  async function load (): Promise<void> {
    credential.value = await usersApi.credential(props.userId)
  }

  onMounted(load)

  async function act (kind: 'issue' | 'revoke' | 'mfa', action: () => Promise<void>): Promise<void> {
    if (busy.value) {
      return
    }

    busy.value = kind

    try {
      await action()
      await load()
    } catch {
      toast.error(t('user.credential.failed'))
    } finally {
      busy.value = null
    }
  }

  function issue (): void {
    void act('issue', async () => {
      issued.value = (await usersApi.issuePassword(props.userId)).password
    })
  }

  function revoke (): void {
    void act('revoke', async () => {
      await usersApi.revokePassword(props.userId)
      toast.success(t('user.credential.revoked'))
    })
  }

  function resetMfa (): void {
    void act('mfa', async () => {
      await usersApi.resetMfa(props.userId)
      toast.success(t('user.credential.mfaReset'))
    })
  }
</script>

<style scoped>
.credential-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
</style>
