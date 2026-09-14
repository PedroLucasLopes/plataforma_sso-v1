<template>
  <DlAppShell
    v-model:collapsed="preferences.navCollapsed"
    v-model:open="navOpen"
    :active="activeNav"
    :groups="groups"
    :loading="routeLoading"
    :max-width="CONTENT_MAX_WIDTH"
    :subtitle="APP_SUBTITLE"
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
  import { useRoute, useRouter } from 'vue-router'
  import { API_PREFIX } from '@/constants/api'
  import { APP_NAME, APP_SUBTITLE, CONTENT_MAX_WIDTH } from '@/constants/layout'
  import { buildNavGroups } from '@/constants/navigation'
  import { ROLE_STATUS } from '@/constants/status'
  import { routeLoading } from '@/router/loading'
  import { usePreferencesStore } from '@/stores/preferences'
  import { useSessionStore } from '@/stores/session'

  /**
   * Casca do console. O menu sai das permissoes do papel, e todo componente
   * abaixo pergunta `can()` pelo mesmo contexto: menu, cabecalho, tabela e
   * abas escondem juntos o que a pessoa nao alcanca.
   */
  const session = useSessionStore()
  const preferences = usePreferencesStore()
  const route = useRoute()
  const router = useRouter()

  providePermissions(toRef(session, 'permissions'), ref(API_PREFIX))

  const navOpen = ref(false)

  const groups = computed(() => buildNavGroups(session.permissions))

  const activeNav = computed(() => route.meta.nav)

  const roleLabel = computed(() => (session.me ? ROLE_STATUS[session.me.role]?.label ?? session.me.role : undefined))

  function navigate (item: NavItem): void {
    void router.push(item.to)
  }
</script>
