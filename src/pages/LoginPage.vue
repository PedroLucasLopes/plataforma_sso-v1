<template>
  <DlSignIn
    :application="request?.application ?? null"
    :brand="APP_NAME"
    :description="stepDescription"
    :error="error"
    :heading="stepHeading"
    :logo="APP_LOGO"
    :pending-provider="pendingProvider"
    :providers="providers"
    :state="state"
    @select="choose"
  >
    <template v-if="state === 'ready'">
      <form v-if="step === 'credentials'" class="login-form" @submit.prevent="submitCredentials">
        <DlTextField
          v-model="email"
          autocomplete="username"
          :disabled="busy"
          :label="t('login.form.email')"
          name="email"
          type="email"
        />

        <DlTextField
          v-model="password"
          autocomplete="current-password"
          :disabled="busy"
          :label="t('login.form.password')"
          name="password"
          type="password"
        />

        <DlButton
          block
          color="primary"
          :loading="busy"
          size="large"
          type="submit"
        >
          {{ t('login.form.submit') }}
        </DlButton>
      </form>

      <form v-else-if="step === 'change_password'" class="login-form" @submit.prevent="submitNewPassword">
        <DlTextField
          v-model="newPassword"
          autocomplete="new-password"
          :disabled="busy"
          :hint="t('login.change.hint')"
          :label="t('login.change.password')"
          name="new-password"
          type="password"
        />

        <DlTextField
          v-model="repeatPassword"
          autocomplete="new-password"
          :disabled="busy"
          :label="t('login.change.repeat')"
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
          {{ t('login.change.submit') }}
        </DlButton>
      </form>

      <div v-else-if="step === 'enroll_mfa'" class="login-form">
        <div v-if="qr" class="login-qr">
          <img :alt="t('login.enroll.qrAlt')" class="login-qr__image" :src="qr">
          <p class="login-qr__secret">{{ t('login.enroll.secret') }} <code>{{ secret }}</code></p>
        </div>

        <form class="login-form" @submit.prevent="submitEnrollment">
          <DlTextField
            v-model="code"
            autocomplete="one-time-code"
            :disabled="busy"
            inputmode="numeric"
            :label="t('login.mfa.code')"
            name="code"
          />

          <DlButton
            block
            color="primary"
            :loading="busy"
            size="large"
            type="submit"
          >
            {{ t('login.enroll.submit') }}
          </DlButton>
        </form>
      </div>

      <form v-else-if="step === 'mfa'" class="login-form" @submit.prevent="submitCode">
        <DlTextField
          v-model="code"
          autocomplete="one-time-code"
          :disabled="busy"
          :hint="t('login.mfa.hint')"
          inputmode="numeric"
          :label="t('login.mfa.code')"
          name="code"
        />

        <DlButton
          block
          color="primary"
          :loading="busy"
          size="large"
          type="submit"
        >
          {{ t('login.mfa.submit') }}
        </DlButton>
      </form>
    </template>
  </DlSignIn>

  <DlSecretDialog
    :copy-label="t('login.recovery.copy')"
    :description="t('login.recovery.description')"
    :model-value="recoveryCodes.length > 0"
    :secret="recoveryCodes.join('\n')"
    :title="t('login.recovery.title')"
    @update:model-value="leaveRecovery"
  />
</template>

<script lang="ts" setup>
  import type { LoginRequestView, LoginStage } from '@/types/sso'
  import {
    DlButton,
    DlSecretDialog,
    DlSignIn,
    DlTextField,
    type SignInError,
    type SignInProvider,
  } from '@pedrolucaslopes/dotlog-ui'
  import QRCode from 'qrcode'
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

  const step = ref<LoginStage>('credentials')
  const email = ref('')
  const password = ref('')
  const newPassword = ref('')
  const repeatPassword = ref('')
  const code = ref('')
  const secret = ref('')
  const qr = ref('')
  const recoveryCodes = ref<string[]>([])
  const busy = ref(false)
  const failure = ref<SignInError | null>(null)

  const stepHeading = computed(() => {
    switch (step.value) {
      case 'change_password': { return t('login.change.title')
      }
      case 'enroll_mfa': { return t('login.enroll.title')
      }
      case 'mfa': { return t('login.mfa.title')
      }
      default: { return null
      }
    }
  })

  const stepDescription = computed(() => {
    switch (step.value) {
      case 'change_password': { return t('login.change.description')
      }
      case 'enroll_mfa': { return t('login.enroll.description')
      }
      case 'mfa': { return t('login.mfa.description')
      }
      default: { return null
      }
    }
  })

  const error = computed<SignInError | null>(() => {
    if (unavailable.value) {
      return {
        title: t('login.unavailable.title'),
        description: t('login.unavailable.description'),
      }
    }

    if (failure.value) {
      return failure.value
    }

    const code_ = queryString(route.query.error)

    if (!code_) {
      return null
    }

    if (state.value === 'blocked' && code_ === 'no_pending_request') {
      return null
    }

    return loginError(code_)
  })

  const providers = computed<SignInProvider[]>(() =>
    step.value === 'credentials'
      ? (request.value?.providers ?? []).map(provider => ({
        id: provider.id,
        label: provider.label,
        icon: PROVIDER_ICONS[provider.id],
      }))
      : [],
  )

  onMounted(async () => {
    try {
      request.value = await sessionApi.loginRequest()
      step.value = request.value.step
      email.value = request.value.email ?? ''
      state.value = 'ready'

      if (step.value === 'enroll_mfa') {
        await startEnrollment()
      }
    } catch (error_) {
      unavailable.value = !(error_ instanceof ApiError) || error_.status !== 404
      state.value = 'blocked'
    }
  })

  async function run (action: () => Promise<void>): Promise<void> {
    if (busy.value) {
      return
    }

    busy.value = true
    failure.value = null

    try {
      await action()
    } catch (error_) {
      failure.value = {
        title: error_ instanceof ApiError ? error_.message : t('login.unavailable.title'),
      }
    } finally {
      busy.value = false
    }
  }

  async function advance (next: Awaited<ReturnType<typeof sessionApi.loginPassword>>): Promise<void> {
    if (next.recoveryCodes?.length) {
      recoveryCodes.value = next.recoveryCodes
    }

    if (next.next === 'done' && next.redirectTo) {
      if (recoveryCodes.value.length > 0) {
        pendingRedirect.value = next.redirectTo
        return
      }

      window.location.assign(next.redirectTo)
      return
    }

    step.value = next.next as LoginStage
    code.value = ''

    if (next.email) {
      email.value = next.email
    }

    if (next.next === 'enroll_mfa') {
      await startEnrollment()
    }
  }

  const pendingRedirect = ref('')

  function leaveRecovery (): void {
    recoveryCodes.value = []

    if (pendingRedirect.value) {
      window.location.assign(pendingRedirect.value)
    }
  }

  async function startEnrollment (): Promise<void> {
    const enrollment = await sessionApi.setupMfa()

    secret.value = enrollment.secret ?? ''
    qr.value = enrollment.otpauth
      ? await QRCode.toDataURL(enrollment.otpauth, { margin: 1, width: 216 })
      : ''
  }

  function submitCredentials (): void {
    void run(async () => {
      await advance(await sessionApi.loginPassword({
        email: email.value.trim(),
        password: password.value,
      }))

      password.value = ''
    })
  }

  function submitNewPassword (): void {
    void run(async () => {
      if (newPassword.value !== repeatPassword.value) {
        throw new ApiError(400, t('login.change.mismatch'))
      }

      await advance(await sessionApi.changePassword({ password: newPassword.value }))

      newPassword.value = ''
      repeatPassword.value = ''
    })
  }

  function submitEnrollment (): void {
    void run(async () => {
      await advance(await sessionApi.confirmMfa({ code: code.value.trim() }))
    })
  }

  function submitCode (): void {
    void run(async () => {
      await advance(await sessionApi.verifyMfa({ code: code.value.trim() }))
    })
  }

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

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.login-qr__image {
  border-radius: var(--dl-radius-sm, 6px);
  background: #fff;
  padding: 8px;
}

.login-qr__secret {
  margin: 0;
  font-size: 12px;
  text-align: center;
  color: var(--dl-on-surface-muted);
  word-break: break-all;
}
</style>
