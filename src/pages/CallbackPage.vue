<template>
  <GateLayout>
    <DlLoader
      v-if="phase === 'working'"
      active
      :delay="0"
      message="Signing you in…"
      variant="inline"
    />

    <DlEmptyState
      v-else
      description="The link that brought you here is no longer valid. Start again and you will return to the console."
      icon="mdi-link-variant-off"
      title="This sign-in could not be completed"
      tone="warning"
    >
      <DlButton icon="mdi-login" @click="session.beginLogin('/')">Sign in again</DlButton>
    </DlEmptyState>
  </GateLayout>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState, DlLoader } from '@pedrolucaslopes/dotlog-ui'
  import { onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import GateLayout from '@/layouts/GateLayout.vue'
  import { useSessionStore } from '@/stores/session'
  import { queryString } from '@/utils/format'

  /**
   * Volta do login do console. E a `redirect_uri` registrada no projeto SSO.
   *
   * Nao ha code a trocar: o console usa a sessao do SSO. O que se confere e o
   * `state`, que precisa ser o que este navegador gerou ao sair. Sem isso,
   * qualquer link externo apontando para ca poderia empurrar a pessoa para uma
   * tela escolhida por outro.
   */
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()

  const phase = ref<'working' | 'failed'>('working')

  onMounted(async () => {
    const outcome = session.completeLogin({
      state: queryString(route.query.state),
      error: queryString(route.query.error),
    })

    if (!outcome.ok) {
      if (outcome.reason === 'access_denied') {
        await session.refresh()
        await router.replace({ name: 'no-access' })

        return
      }

      phase.value = 'failed'

      return
    }

    const status = await session.ensure()

    switch (status) {
      case 'authenticated': {
        await router.replace(outcome.returnTo)

        break
      }
      case 'no-access': {
        await router.replace({ name: 'no-access' })

        break
      }
      case 'unavailable': {
        await router.replace({ name: 'unavailable', query: { from: outcome.returnTo } })

        break
      }
      default: {
        phase.value = 'failed'
      }
    }
  })
</script>
