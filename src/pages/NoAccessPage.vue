<template>
  <GateLayout>
    <DlEmptyState
      :description="description"
      icon="mdi-shield-lock-outline"
      :title="t('noAccess.title')"
      tone="warning"
    >
      <DlButton
        icon="mdi-account-switch-outline"
        :loading="session.signingOut"
        variant="outlined"
        @click="session.signOut()"
      >
        {{ t('noAccess.useAnotherAccount') }}
      </DlButton>
    </DlEmptyState>
  </GateLayout>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import GateLayout from '@/layouts/GateLayout.vue'
  import { useSessionStore } from '@/stores/session'

  const { t } = useI18n()
  const router = useRouter()
  const session = useSessionStore()

  const description = computed(() =>
    session.identity
      ? t('noAccess.descriptionAs', { name: session.identity.name, email: session.identity.email })
      : t('noAccess.description'),
  )

  onMounted(async () => {
    if ((await session.ensure()) === 'authenticated') {
      await router.replace('/')
    }
  })
</script>
