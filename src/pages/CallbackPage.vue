<template>
  <GateLayout>
    <DlLoader
      v-if="phase === 'working'"
      active
      :delay="0"
      :message="t('callback.working')"
      variant="inline"
    />

    <DlEmptyState
      v-else
      :description="t('callback.failedDescription')"
      icon="mdi-link-variant-off"
      :title="t('callback.failedTitle')"
      tone="warning"
    >
      <DlButton icon="mdi-login" @click="session.beginLogin('/')">{{ t('callback.signInAgain') }}</DlButton>
    </DlEmptyState>
  </GateLayout>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState, DlLoader } from '@pedrolucaslopes/dotlog-ui'
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import GateLayout from '@/layouts/GateLayout.vue'
  import { useSessionStore } from '@/stores/session'
  import { queryString } from '@/utils/format'

  const { t } = useI18n()
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
