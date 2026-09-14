<template>
  <DlEmptyState
    description="Your role does not include this area. Ask an administrator if you need it."
    icon="mdi-lock-outline"
    title="You cannot open this page"
    tone="warning"
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
