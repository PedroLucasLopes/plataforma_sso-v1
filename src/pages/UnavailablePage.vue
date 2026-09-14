<template>
  <GateLayout>
    <DlEmptyState
      description="The console could not reach the SSO. Nothing was changed. Try again in a moment."
      icon="mdi-cloud-alert-outline"
      title="The SSO is not responding"
      tone="error"
    >
      <DlButton icon="mdi-refresh" :loading="retrying" @click="retry">Try again</DlButton>
    </DlEmptyState>
  </GateLayout>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState, toast } from '@pedrolucaslopes/dotlog-ui'
  import { ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import GateLayout from '@/layouts/GateLayout.vue'
  import { safeReturnPath, useSessionStore } from '@/stores/session'
  import { queryString } from '@/utils/format'

  /**
   * O SSO nao respondeu, e sem ele nao da para afirmar se a pessoa tem sessao.
   * A tela nao manda ao login, que tambem depende do SSO: so oferece tentar.
   */
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()

  const retrying = ref(false)

  async function retry (): Promise<void> {
    retrying.value = true

    try {
      if ((await session.refresh()) === 'unavailable') {
        toast.error('The SSO is still not responding', {
          description: 'Check that the service is running, then try again.',
        })

        return
      }

      await router.replace(safeReturnPath(queryString(route.query.from)))
    } finally {
      retrying.value = false
    }
  }
</script>
