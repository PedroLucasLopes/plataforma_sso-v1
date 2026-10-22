<template>
  <DlSignIn
    :application="null"
    :brand="APP_NAME"
    :description="description"
    :error="failure"
    :heading="t('account.title')"
    :logo="APP_LOGO"
    :state="state"
  >
    <template v-if="state === 'ready' && profile">
      <section class="account-section">
        <h2 class="account-section__title">{{ t('account.identity.title') }}</h2>
        <p class="account-section__text">{{ profile.name }}</p>
        <p class="account-section__muted">{{ profile.email }}</p>

        <p v-if="profile.applications.length > 0" class="account-section__muted">
          {{ t('account.identity.applications', { applications: profile.applications.join(', ') }) }}
        </p>
      </section>

      <section class="account-section">
        <h2 class="account-section__title">{{ t('account.secondFactor.title') }}</h2>

        <p v-if="profile.secondFactor.enrolled" class="account-section__text">
          {{ t('account.secondFactor.enrolled', { count: profile.secondFactor.recoveryCodesLeft }) }}
        </p>

        <div v-else-if="enrollment" class="account-form">
          <div class="account-qr">
            <img :alt="t('login.enroll.qrAlt')" class="account-qr__image" :src="enrollment.qr">
            <p class="account-qr__secret">{{ t('login.enroll.secret') }} <code>{{ enrollment.secret }}</code></p>
          </div>

          <form class="account-form" @submit.prevent="confirmEnrollment">
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
              type="submit"
            >
              {{ t('login.enroll.submit') }}
            </DlButton>
          </form>
        </div>

        <form v-else class="account-form" @submit.prevent="startEnrollment">
          <p class="account-section__text">{{ t('account.secondFactor.missing') }}</p>

          <DlTextField
            v-if="profile.password"
            v-model="password"
            autocomplete="current-password"
            :disabled="busy"
            :hint="t('account.secondFactor.passwordHint')"
            :label="t('account.secondFactor.password')"
            name="current-password"
            type="password"
          />

          <DlButton
            block
            color="primary"
            :loading="busy"
            type="submit"
          >
            {{ t('account.secondFactor.start') }}
          </DlButton>
        </form>
      </section>

      <section class="account-section">
        <h2 class="account-section__title">{{ t('account.deletion.title') }}</h2>
        <p class="account-section__text">{{ deletionText }}</p>

        <DlButton
          v-if="!deletionSent"
          block
          color="error"
          :disabled="!profile.deletion.allowed"
          variant="outlined"
          @click="askDeletion = true"
        >
          {{ t('account.deletion.start') }}
        </DlButton>
      </section>
    </template>

    <template v-if="state === 'ready' && profile" #footer>
      <DlButton
        block
        :loading="signingOut"
        size="small"
        variant="text"
        @click="signOut"
      >
        {{ t('account.signOut') }}
      </DlButton>
    </template>
  </DlSignIn>

  <DlConfirmDialog
    v-model="askDeletion"
    :confirm-label="t('account.deletion.confirm')"
    destructive
    :message="t('account.deletion.confirmMessage', { email: profile?.email ?? '' })"
    :processing="busy"
    :title="t('account.deletion.confirmTitle')"
    @confirm="requestDeletion"
  />

  <DlSecretDialog
    :copy-label="t('login.recovery.copy')"
    :description="t('login.recovery.description')"
    :model-value="recoveryCodes.length > 0"
    :secret="recoveryCodes.join('\n')"
    :title="t('login.recovery.title')"
    @update:model-value="recoveryCodes = []"
  />
</template>

<script lang="ts" setup>
  import type { AccountProfileView } from '@/types/sso'
  import {
    DlButton,
    DlConfirmDialog,
    DlSecretDialog,
    DlSignIn,
    DlTextField,
    type SignInError,
  } from '@pedrolucaslopes/dotlog-ui'
  import QRCode from 'qrcode'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { APP_LOGO, APP_NAME } from '@/constants/layout'
  import { ApiError } from '@/services/http'
  import { accountApi, sessionApi } from '@/services/sso'
  import { useSessionStore } from '@/stores/session'

  const { t, locale } = useI18n()
  const session = useSessionStore()

  const state = ref<'loading' | 'ready' | 'blocked'>('loading')
  const profile = ref<AccountProfileView | null>(null)
  const signedOut = ref(false)
  const failure = ref<SignInError | null>(null)
  const busy = ref(false)
  const signingOut = ref(false)
  const password = ref('')
  const code = ref('')
  const enrollment = ref<{ secret: string, qr: string } | null>(null)
  const recoveryCodes = ref<string[]>([])
  const askDeletion = ref(false)
  const deletionSent = ref(false)

  const description = computed(() => {
    if (signedOut.value) {
      return t('account.signedOut')
    }

    return profile.value ? t('account.description') : null
  })

  const deletionText = computed(() => {
    const current = profile.value

    if (!current) {
      return ''
    }

    if (deletionSent.value) {
      return t('account.deletion.sent', { email: current.email })
    }

    if (current.deletion.reason === 'admin') {
      return t('account.deletion.admin')
    }

    if (current.deletion.reason === 'email_unavailable') {
      return t('account.deletion.unavailable')
    }

    return t('account.deletion.description')
  })

  function endSession (): void {
    profile.value = null
    enrollment.value = null
    signedOut.value = true
    session.csrfToken = null
  }

  async function load (): Promise<void> {
    try {
      const current = await accountApi.profile()

      profile.value = current
      session.csrfToken = current.csrfToken
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        endSession()
      } else {
        failure.value = { title: t('login.unavailable.title'), description: t('login.unavailable.description') }
      }
    } finally {
      state.value = 'ready'
    }
  }

  onMounted(load)

  async function run (action: () => Promise<void>): Promise<void> {
    if (busy.value) {
      return
    }

    busy.value = true
    failure.value = null

    try {
      await action()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'login_required') {
        endSession()
        return
      }

      failure.value = { title: error instanceof ApiError ? error.message : t('login.unavailable.title') }
    } finally {
      busy.value = false
    }
  }

  function startEnrollment (): void {
    void run(async () => {
      const started = await accountApi.setupMfa(profile.value?.password ? { password: password.value } : {})

      password.value = ''
      code.value = ''
      enrollment.value = {
        secret: started.secret,
        qr: await QRCode.toDataURL(started.otpauth, { margin: 1, width: 216 }),
      }
    })
  }

  function confirmEnrollment (): void {
    void run(async () => {
      const confirmed = await accountApi.confirmMfa({ code: code.value.trim() })

      enrollment.value = null
      code.value = ''
      recoveryCodes.value = confirmed.recoveryCodes
      await load()
    })
  }

  function requestDeletion (): void {
    void run(async () => {
      await accountApi.requestDeletion({ locale: locale.value })

      deletionSent.value = true
    }).finally(() => {
      askDeletion.value = false
    })
  }

  async function signOut (): Promise<void> {
    signingOut.value = true

    await sessionApi.logout().catch(() => null)

    signingOut.value = false
    endSession()
  }
</script>

<style scoped>
.account-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
  border-top: 1px solid var(--dl-border, rgba(127, 127, 127, 0.2));
}

.account-section:first-child {
  border-top: 0;
  padding-top: 0;
}

.account-section__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.account-section__text {
  margin: 0;
  font-size: 14px;
}

.account-section__muted {
  margin: 0;
  font-size: 13px;
  color: var(--dl-on-surface-muted);
  word-break: break-word;
}

.account-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.account-qr__image {
  border-radius: var(--dl-radius-sm, 6px);
  background: #fff;
  padding: 8px;
}

.account-qr__secret {
  margin: 0;
  font-size: 12px;
  text-align: center;
  color: var(--dl-on-surface-muted);
  word-break: break-all;
}
</style>
