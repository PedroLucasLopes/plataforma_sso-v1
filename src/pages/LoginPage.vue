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

  /**
   * A tela de login do IdP, a mesma para toda aplicacao do ecossistema.
   *
   * So oferece provedor quando ha um pedido pendente, criado por uma aplicacao
   * que viu alguem sem sessao. Aberta direto, explica que o login comeca pela
   * aplicacao. O SSO garante o mesmo do lado dele: sem pedido, ir ao Google
   * devolve a pessoa para ca, e o pedido nunca e criado por esta tela.
   */
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

    // A tela bloqueada ja diz que nao ha pedido; repetir so empilharia texto.
    if (state.value === 'blocked' && code === 'no_pending_request') {
      return null
    }

    // So codigo conhecido vira texto. O que vier fora da lista nao e ecoado.
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
      // 404 e o esperado sem pedido pendente. Qualquer outra falha tambem nao
      // pode oferecer login, mas merece dizer que o SSO nao respondeu.
      unavailable.value = !(error_ instanceof ApiError) || error_.status !== 404
      state.value = 'blocked'
    }
  })

  /** Navegacao de pagina, e so para endereco http(s) vindo do proprio SSO. */
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

  /**
   * Voltar do Google pelo botao do navegador restaura esta pagina do cache,
   * com o botao ainda girando. A pessoa precisa poder escolher de novo.
   */
  function onPageShow (event: PageTransitionEvent): void {
    if (event.persisted) {
      pendingProvider.value = null
    }
  }

  onMounted(() => window.addEventListener('pageshow', onPageShow))
  onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))
</script>
