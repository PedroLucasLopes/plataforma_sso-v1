<template>
  <GateLayout>
    <DlEmptyState
      :description="description"
      icon="mdi-shield-lock-outline"
      title="You don't have access to the SSO console"
      tone="warning"
    >
      <DlButton
        icon="mdi-account-switch-outline"
        :loading="session.signingOut"
        variant="outlined"
        @click="session.signOut()"
      >
        Use another account
      </DlButton>
    </DlEmptyState>
  </GateLayout>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted } from 'vue'
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
  const router = useRouter()
  const session = useSessionStore()

  const description = computed(() =>
    session.identity
      ? `You are signed in as ${session.identity.name} (${session.identity.email}), but this account has no role in the SSO project. Ask an administrator for access.`
      : 'Your account has no role in the SSO project. Ask an administrator for access.',
  )

  onMounted(async () => {
    // Aberta direto por quem tem acesso, a tela so atrapalharia.
    if ((await session.ensure()) === 'authenticated') {
      await router.replace('/')
    }
  })
</script>
