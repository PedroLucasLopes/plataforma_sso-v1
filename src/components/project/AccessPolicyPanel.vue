<template>
  <DlSectionCard :description="t('access.policy.description')" :title="t('access.policy.title')">
    <template v-if="canEditPolicy" #actions>
      <DlButton
        :disabled="!policyDirty"
        icon="mdi-content-save-outline"
        :loading="savingPolicy"
        variant="tonal"
        @click="savePolicy"
      >
        {{ t('access.save') }}
      </DlButton>
    </template>

    <div class="access-grid">
      <DlSelect
        :clearable="false"
        :disabled="!canEditPolicy"
        :hint="t('access.policy.signupHint')"
        :label="t('access.policy.signup')"
        :model-value="policy.signupPolicy"
        :options="signupOptions"
        @update:model-value="value => (policy.signupPolicy = asOption(value) === 'OPEN' ? 'OPEN' : 'CLOSED')"
      />

      <DlSelect
        :disabled="!canEditPolicy"
        :hint="t('access.policy.defaultRoleHint')"
        :label="t('access.policy.defaultRole')"
        :model-value="policy.defaultRoleId"
        :options="roleOptions"
        @update:model-value="value => (policy.defaultRoleId = asOption(value))"
      />

      <DlSelect
        :clearable="false"
        :disabled="!canEditPolicy"
        :hint="t('access.policy.mfaHint')"
        :label="t('access.policy.mfa')"
        :model-value="policy.mfaPolicy"
        :options="mfaOptions"
        @update:model-value="value => (policy.mfaPolicy = asOption(value) === 'OPTIONAL' ? 'OPTIONAL' : 'REQUIRED')"
      />
    </div>

    <p v-if="policyError" class="access-error" role="alert">{{ policyError }}</p>

    <template #footer>
      {{ policyNote }}
    </template>
  </DlSectionCard>

  <DlSectionCard v-if="!isSelf" :description="t('access.brand.description')" :title="t('access.brand.title')">
    <template v-if="canEditBrand" #actions>
      <DlButton
        :disabled="!brandDirty"
        icon="mdi-content-save-outline"
        :loading="savingBrand"
        variant="tonal"
        @click="saveBrand"
      >
        {{ t('access.save') }}
      </DlButton>
    </template>

    <div class="access-grid">
      <DlTextField
        :disabled="!canEditBrand"
        :error="displayNameError"
        :hint="t('access.brand.displayNameHint', { name: project.name })"
        :label="t('access.brand.displayName')"
        :model-value="brand.displayName"
        @update:model-value="value => (brand.displayName = asText(value))"
      />

      <DlFileDrop
        :accept="LOGO_TYPES"
        :disabled="!canEditBrand"
        :error="logoError"
        :hint="t('access.brand.logoHint', { size: logoLimitKb })"
        icon="mdi-image-outline"
        :label="t('access.brand.logo')"
        :max-size="LOGO_MAX_BYTES"
        :model-value="logoFile"
        @rejected="onLogoRejected"
        @update:model-value="onLogo"
      />
    </div>

    <div v-if="brand.logo" class="access-logo">
      <img :alt="t('login.brandLogo', { application: brand.displayName.trim() || project.name })" :src="brand.logo">

      <DlButton
        v-if="canEditBrand"
        icon="mdi-close"
        size="small"
        variant="text"
        @click="clearLogo"
      >
        {{ t('access.brand.removeLogo') }}
      </DlButton>
    </div>

    <p v-if="brandError" class="access-error" role="alert">{{ brandError }}</p>
  </DlSectionCard>
</template>

<script lang="ts" setup>
  import type { MfaPolicy, ProjectOverview, SignupPolicy } from '@/types/sso'
  import type { FileRejection } from '@pedrolucaslopes/dotlog-ui'
  import {
    DlButton,
    DlFileDrop,
    DlSectionCard,
    DlSelect,
    DlTextField,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { DISPLAY_NAME_MAX_LENGTH, LOGO_MAX_BYTES, LOGO_TYPES, SELF_PROJECT_NAME } from '@/constants/api'
  import { errorMessage } from '@/services/http'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { asOption, asText } from '@/utils/forms'
  import { roleLabel, sortRoles } from '@/utils/routes'

  const props = defineProps<{ project: ProjectOverview }>()

  const { t } = useI18n()
  const session = useSessionStore()
  const projects = useProjectsStore()

  const logoLimitKb = LOGO_MAX_BYTES / 1024

  const isSelf = computed(() => props.project.name === SELF_PROJECT_NAME)

  const canEditPolicy = computed(() =>
    !isSelf.value && session.root && session.can('PATCH', `/project/${props.project.id}/policy`),
  )

  const canEditBrand = computed(() => !isSelf.value && session.can('PUT', `/project/${props.project.id}`))

  const policy = reactive<{ signupPolicy: SignupPolicy, mfaPolicy: MfaPolicy, defaultRoleId: string | null }>({
    signupPolicy: 'CLOSED',
    mfaPolicy: 'REQUIRED',
    defaultRoleId: null,
  })

  const brand = reactive<{ displayName: string, logo: string | null }>({ displayName: '', logo: null })

  const logoFile = ref<File | null>(null)
  const logoError = ref<string | null>(null)
  const policyError = ref<string | null>(null)
  const brandError = ref<string | null>(null)
  const savingPolicy = ref(false)
  const savingBrand = ref(false)

  watch(
    () => [props.project.signupPolicy, props.project.mfaPolicy, props.project.defaultRoleId] as const,
    ([signupPolicy, mfaPolicy, defaultRoleId]) => {
      policy.signupPolicy = signupPolicy
      policy.mfaPolicy = mfaPolicy
      policy.defaultRoleId = defaultRoleId
    },
    { immediate: true },
  )

  watch(
    () => [props.project.displayName, props.project.logo] as const,
    ([displayName, logo]) => {
      brand.displayName = displayName ?? ''
      brand.logo = logo
      logoFile.value = null
      logoError.value = null
    },
    { immediate: true },
  )

  const policyDirty = computed(() =>
    policy.signupPolicy !== props.project.signupPolicy
    || policy.mfaPolicy !== props.project.mfaPolicy
    || policy.defaultRoleId !== props.project.defaultRoleId,
  )

  const brandDirty = computed(() =>
    (brand.displayName.trim() || null) !== props.project.displayName
    || brand.logo !== props.project.logo,
  )

  const displayNameError = computed(() =>
    brand.displayName.trim().length > DISPLAY_NAME_MAX_LENGTH
      ? t('access.brand.displayNameTooLong', { size: DISPLAY_NAME_MAX_LENGTH })
      : null,
  )

  const signupOptions = computed(() => [
    { title: t('access.policy.closed'), value: 'CLOSED' },
    { title: t('access.policy.open'), value: 'OPEN' },
  ])

  const mfaOptions = computed(() => [
    { title: t('access.policy.required'), value: 'REQUIRED' },
    { title: t('access.policy.optional'), value: 'OPTIONAL' },
  ])

  const roleOptions = computed(() =>
    sortRoles(props.project.roles).map(role => ({ title: roleLabel(role.name), value: role.id })),
  )

  const policyNote = computed(() => {
    if (isSelf.value) {
      return t('access.policy.selfNote')
    }

    return session.root ? t('access.policy.note') : t('access.policy.rootOnly')
  })

  async function savePolicy (): Promise<void> {
    policyError.value = null
    savingPolicy.value = true

    try {
      await projects.setPolicy(props.project.id, { ...policy })
      toast.success(t('access.policy.saved'))
    } catch (error) {
      policyError.value = errorMessage(error)
    } finally {
      savingPolicy.value = false
    }
  }

  async function saveBrand (): Promise<void> {
    brandError.value = null

    if (displayNameError.value) {
      return
    }

    savingBrand.value = true

    try {
      await projects.setBranding(props.project.id, {
        displayName: brand.displayName.trim() || null,
        logo: brand.logo,
      })
      toast.success(t('access.brand.saved'))
    } catch (error) {
      brandError.value = errorMessage(error)
    } finally {
      savingBrand.value = false
    }
  }

  function readDataUrl (file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.addEventListener('load', () => resolve(String(reader.result)))
      reader.addEventListener('error', () => reject(reader.error))
      reader.readAsDataURL(file)
    })
  }

  async function onLogo (file: File | null): Promise<void> {
    logoError.value = null
    logoFile.value = file

    if (!file) {
      return
    }

    try {
      brand.logo = await readDataUrl(file)
    } catch {
      logoError.value = t('access.brand.logoUnreadable')
    }
  }

  function onLogoRejected (reason: FileRejection): void {
    logoError.value = reason === 'size'
      ? t('access.brand.logoTooLarge', { size: logoLimitKb })
      : t('access.brand.logoType')
  }

  function clearLogo (): void {
    brand.logo = null
    logoFile.value = null
    logoError.value = null
  }
</script>

<style scoped>
.access-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.access-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.access-logo img {
  max-width: 160px;
  max-height: 64px;
  object-fit: contain;
  border-radius: var(--dl-radius-sm, 6px);
}

.access-error {
  margin: 12px 0 0;
  color: rgb(var(--v-theme-error));
}
</style>
