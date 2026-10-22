<template>
  <DlSignIn
    :application="view?.application ?? null"
    :brand="APP_NAME"
    :description="description"
    :error="failure"
    :heading="heading"
    :logo="APP_LOGO"
    :state="state"
  >
    <template v-if="state === 'ready'">
      <img
        v-if="view?.logo"
        :alt="t('login.brandLogo', { application: view.application })"
        class="link-brand"
        :src="view.logo"
      >

      <div v-if="phase === 'form' && view?.purpose === 'delete'" class="link-form">
        <DlButton
          block
          color="error"
          :loading="busy"
          size="large"
          @click="erase"
        >
          {{ t('link.delete.submit') }}
        </DlButton>
      </div>

      <form v-else-if="phase === 'form' && view" class="link-form" @submit.prevent="submit">
        <DlTextField
          v-if="view.purpose === 'signup'"
          v-model="name"
          autocomplete="name"
          :disabled="busy"
          :label="t('link.name')"
          name="name"
        />

        <DlTextField
          v-model="password"
          autocomplete="new-password"
          :disabled="busy"
          :hint="t('link.passwordHint')"
          :label="t('link.password')"
          name="new-password"
          type="password"
        />

        <DlTextField
          v-model="repeat"
          autocomplete="new-password"
          :disabled="busy"
          :label="t('link.repeat')"
          name="repeat-password"
          type="password"
        />

        <DlButton
          block
          color="primary"
          :loading="busy"
          size="large"
          type="submit"
        >
          {{ view.purpose === 'signup' ? t('link.signup.submit') : t('link.newPassword.submit') }}
        </DlButton>
      </form>

      <div v-else-if="phase === 'finished' && continueTo" class="link-form">
        <DlButton block color="primary" size="large" @click="go(continueTo)">
          {{ t('link.continue', { application: view?.application ?? '' }) }}
        </DlButton>
      </div>
    </template>
  </DlSignIn>
</template>

<script lang="ts" setup>
  import type { AccountLinkView, LoginStepView } from '@/types/sso'
  import { DlButton, DlSignIn, DlTextField, type SignInError } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { LINK_PATH, LOGIN_PATH } from '@/constants/api'
  import { APP_LOGO, APP_NAME } from '@/constants/layout'
  import { ApiError } from '@/services/http'
  import { accountApi } from '@/services/sso'

  type Phase = 'form' | 'finished' | 'invalid'
  type Outcome = 'created' | 'createdSignIn' | 'passwordChanged' | 'deleted'

  const { t } = useI18n()

  const state = ref<'loading' | 'ready' | 'blocked'>('loading')
  const phase = ref<Phase>('invalid')
  const outcome = ref<Outcome>('created')
  const view = ref<AccountLinkView | null>(null)
  const token = ref('')
  const name = ref('')
  const password = ref('')
  const repeat = ref('')
  const continueTo = ref<string | null>(null)
  const busy = ref(false)
  const failure = ref<SignInError | null>(null)

  const heading = computed(() => {
    if (phase.value === 'invalid') {
      return t('link.invalid.title')
    }

    if (phase.value === 'finished') {
      return t(`link.done.${outcome.value}.title`)
    }

    if (view.value?.purpose === 'delete') {
      return t('link.delete.title')
    }

    return view.value?.purpose === 'signup' ? t('link.signup.title') : t('link.newPassword.title')
  })

  const description = computed(() => {
    const application = view.value?.application ?? ''
    const email = view.value?.email ?? ''

    if (phase.value === 'invalid') {
      return t('link.invalid.description')
    }

    if (phase.value === 'finished') {
      return t(`link.done.${outcome.value}.description`, { application })
    }

    if (view.value?.purpose === 'delete') {
      return t('link.delete.description', { email, application })
    }

    return view.value?.purpose === 'signup'
      ? t('link.signup.description', { email, application })
      : t('link.newPassword.description', { email })
  })

  function readToken (): string {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''

    window.history.replaceState(window.history.state, '', LINK_PATH)

    return fragment
  }

  onMounted(async () => {
    token.value = readToken()

    if (!token.value) {
      state.value = 'ready'
      return
    }

    try {
      view.value = await accountApi.link(token.value)
      phase.value = 'form'
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'link_invalid') {
        failure.value = { title: t('login.unavailable.title'), description: t('login.unavailable.description') }
      }
    } finally {
      state.value = 'ready'
    }
  })

  function safeTarget (target: string | null | undefined): string | null {
    if (!target) {
      return null
    }

    try {
      const url = new URL(target, window.location.origin)

      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
    } catch {
      return null
    }
  }

  function go (target: string): void {
    window.location.assign(target)
  }

  function finish (result: LoginStepView, done: Outcome): void {
    const redirect = safeTarget(result.redirectTo)

    if (redirect) {
      go(redirect)
      return
    }

    if (result.next === 'enroll_mfa') {
      go(LOGIN_PATH)
      return
    }

    continueTo.value = safeTarget(result.continueTo)
    outcome.value = done
    phase.value = 'finished'
  }

  async function erase (): Promise<void> {
    if (busy.value) {
      return
    }

    failure.value = null
    busy.value = true

    try {
      await accountApi.delete(token.value)

      continueTo.value = null
      outcome.value = 'deleted'
      phase.value = 'finished'
    } catch (error) {
      if (error instanceof ApiError && error.code === 'link_invalid') {
        phase.value = 'invalid'
        return
      }

      failure.value = { title: error instanceof ApiError ? error.message : t('login.unavailable.title') }
    } finally {
      busy.value = false
    }
  }

  async function submit (): Promise<void> {
    const current = view.value

    if (busy.value || !current) {
      return
    }

    failure.value = null

    if (password.value !== repeat.value) {
      failure.value = { title: t('link.mismatch') }
      return
    }

    busy.value = true

    try {
      if (current.purpose === 'signup') {
        const result = await accountApi.signup({ token: token.value, name: name.value.trim(), password: password.value })

        finish(result, result.next === 'done' ? 'created' : 'createdSignIn')
      } else {
        finish(await accountApi.password({ token: token.value, password: password.value }), 'passwordChanged')
      }

      password.value = ''
      repeat.value = ''
    } catch (error) {
      if (error instanceof ApiError && error.code === 'link_invalid') {
        phase.value = 'invalid'
        return
      }

      failure.value = { title: error instanceof ApiError ? error.message : t('login.unavailable.title') }
    } finally {
      busy.value = false
    }
  }
</script>

<style scoped>
.link-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-brand {
  display: block;
  max-width: 160px;
  max-height: 64px;
  margin: 0 auto 4px;
  object-fit: contain;
}
</style>
