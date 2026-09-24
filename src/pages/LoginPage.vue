<template>
  <DlSignIn
    :application="request?.application ?? null"
    :brand="APP_NAME"
    :error="error"
    :logo="APP_LOGO"
    :pending-provider="pendingProvider"
    :providers="providers"
    :state="state"
    @select="choose"
  />
</template>

<script lang="ts" setup>
  import type { LoginRequestView } from '@/types/sso'
  import { DlSignIn, type SignInError, type SignInProvider } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute } from 'vue-router'
  import { APP_LOGO, APP_NAME } from '@/constants/layout'
  import { loginError, PROVIDER_ICONS } from '@/constants/messages'
  import { ApiError } from '@/services/http'
  import { sessionApi } from '@/services/sso'
  import { queryString } from '@/utils/format'

  const { t } = useI18n()
  const route = useRoute()

  const state = ref<'loading' | 'ready' | 'blocked'>('loading')
  const request = ref<LoginRequestView | null>(null)
  const pendingProvider = ref<string | null>(null)
  const unavailable = ref(false)

  const error = computed<SignInError | null>(() => {
    if (unavailable.value) {
      return {
        title: t('login.unavailable.title'),
        description: t('login.unavailable.description'),
      }
    }

    const code = queryString(route.query.error)

    if (!code) {
      return null
    }

    if (state.value === 'blocked' && code === 'no_pending_request') {
      return null
    }

    return loginError(code)
  })

  const providers = computed<SignInProvider[]>(() =>
    (request.value?.providers ?? []).map(provider => ({
      id: provider.id,
      label: provider.label,
      icon: PROVIDER_ICONS[provider.id],
    })),
  )

  onMounted(async () => {
    try {
      request.value = await sessionApi.loginRequest()
      state.value = 'ready'
    } catch (error_) {
      unavailable.value = !(error_ instanceof ApiError) || error_.status !== 404
      state.value = 'blocked'
    }
  })

  function choose (provider: SignInProvider): void {
    const target = request.value?.providers.find(item => item.id === provider.id)

    if (!target || pendingProvider.value) {
      return
    }

    let url: URL

    try {
      url = new URL(target.url, window.location.origin)
    } catch {
      return
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return
    }

    pendingProvider.value = provider.id
    window.location.assign(url.toString())
  }

  function onPageShow (event: PageTransitionEvent): void {
    if (event.persisted) {
      pendingProvider.value = null
    }
  }

  onMounted(() => window.addEventListener('pageshow', onPageShow))
  onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))
</script>
