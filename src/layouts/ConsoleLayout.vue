<template>
  <DlAppShell
    v-model:collapsed="preferences.navCollapsed"
    v-model:open="navOpen"
    :active="activeNav"
    :groups="groups"
    :loading="routeLoading"
    :logo="APP_LOGO"
    :max-width="CONTENT_MAX_WIDTH"
    :subtitle="t('app.subtitle')"
    :title="APP_NAME"
    @navigate="navigate"
  >
    <template #top-actions>
      <DlUserMenu
        v-if="session.me"
        :email="session.me.email"
        :name="session.me.name"
        :role="roleLabel"
        :signing-out="session.signingOut"
        :theme-mode="preferences.themeMode"
        @sign-out="session.signOut()"
        @update:theme-mode="preferences.setThemeMode"
      />
    </template>

    <RouterView v-slot="{ Component, route: current }">
      <Transition mode="out-in" name="page">
        <component :is="Component" :key="current.path" />
      </Transition>
    </RouterView>
  </DlAppShell>
</template>

<script lang="ts" setup>
  import { DlAppShell, DlUserMenu, type NavItem, providePermissions } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref, toRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { API_PREFIX } from '@/constants/api'
  import { APP_LOGO, APP_NAME, CONTENT_MAX_WIDTH } from '@/constants/layout'
  import { buildNavGroups } from '@/constants/navigation'
  import { routeLoading } from '@/router/loading'
  import { usePreferencesStore } from '@/stores/preferences'
  import { useSessionStore } from '@/stores/session'
  import { roleLabel as labelOf } from '@/utils/routes'

  /**
   * Casca do console. O menu sai das permissoes do papel, e todo componente
   * abaixo pergunta `can()` pelo mesmo contexto: menu, cabecalho, tabela e
   * abas escondem juntos o que a pessoa nao alcanca.
   *
   * As linguas do menu do usuario sao os JSON de `src/locales`: o `DlUserMenu`
   * lista e troca sozinho, e menu, cabecalho e telas mudam juntos.
   */
  const { t } = useI18n()
  const session = useSessionStore()
  const preferences = usePreferencesStore()
  const route = useRoute()
  const router = useRouter()

  providePermissions(toRef(session, 'permissions'), ref(API_PREFIX))

  const navOpen = ref(false)

  const groups = computed(() => buildNavGroups(session.permissions))

  const activeNav = computed(() => route.meta.nav)

  const roleLabel = computed(() => (session.me ? labelOf(session.me.role) : undefined))

  function navigate (item: NavItem): void {
    void router.push(item.to)
  }
</script>
