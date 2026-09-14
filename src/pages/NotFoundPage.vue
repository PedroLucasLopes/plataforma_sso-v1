<template>
  <DlEmptyState
    description="The address may be mistyped, or the page moved. The menu on the side has everything your role can open."
    icon="mdi-map-marker-question-outline"
    title="This page does not exist"
  >
    <DlButton icon="mdi-view-dashboard-outline" variant="tonal" @click="router.push('/')">
      Go to the overview
    </DlButton>
  </DlEmptyState>
</template>

<script lang="ts" setup>
  import { DlButton, DlEmptyState } from '@pedrolucaslopes/dotlog-ui'
  import { useRouter } from 'vue-router'

  const router = useRouter()
</script>
