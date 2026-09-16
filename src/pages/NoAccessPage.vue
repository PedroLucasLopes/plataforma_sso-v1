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

  /**
   * Sessao valida, sem papel no projeto SSO.
   *
   * A pessoa entrou de verdade: a conta existe e o Google confirmou. Ela so nao
   * administra nada aqui. Dizer com qual conta ela entrou evita o engano mais
   * comum, que e ter usado a conta pessoal no lugar da do trabalho.
   */
  const { t } = useI18n()
  const router = useRouter()
  const session = useSessionStore()

  const description = computed(() =>
    session.identity
      ? t('noAccess.descriptionAs', { name: session.identity.name, email: session.identity.email })
      : t('noAccess.description'),
  )

  onMounted(async () => {
    // Aberta direto por quem tem acesso, a tela so atrapalharia.
    if ((await session.ensure()) === 'authenticated') {
      await router.replace('/')
    }
  })
</script>
