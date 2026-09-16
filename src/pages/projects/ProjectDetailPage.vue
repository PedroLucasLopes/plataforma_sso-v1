<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('common.projects'), to: '/projects' }, { label: title }]"
      :description="headerDescription"
      :title="title"
      :with-menu="false"
      @action="onAction"
      @navigate="to => router.push(to)"
    />

    <DlSkeleton v-if="loading && !project" height="260px" variant="block" />

    <DlEmptyState
      v-else-if="loadError && !project"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      :title="t('project.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <DlTabs v-else-if="project" v-model="tab" :tabs="tabs">
      <template #overview>
        <DlSectionCard :description="t('project.identity.description')" :title="t('project.identity.title')">
          <DlDescriptionList :items="identityItems">
            <template #item-status>
              <DlStatusChip :map="PROJECT_STATUS" size="default" :status="project.status" />
            </template>
          </DlDescriptionList>

          <template v-if="isSelf" #footer>
            {{ t('project.identity.selfNote') }}
          </template>
        </DlSectionCard>

        <ActivationChecklist
          v-if="overview"
          :activating="statusChange.processing"
          :can-activate="session.can('PATCH', `/project/${project.id}/status`)"
          :overview="overview"
          @activate="statusChange.ask('ACTIVE')"
        />
      </template>

      <template #redirects>
        <RedirectUrisPanel v-if="overview" :project="overview" />
      </template>

      <template #routes>
        <RoutesPanel v-if="overview" :project="overview" />
      </template>

      <template #roles>
        <RolesPanel v-if="overview" :project="overview" />
      </template>

      <template #members>
        <MembersPanel v-if="overview" :project="overview" />
      </template>

      <template #keys>
        <ClientKeysPanel :project-id="project.id" :project-name="project.name" />
      </template>
    </DlTabs>

    <DlFormDialog
      v-model="renameDialog.open"
      :description="t('projects.renameDescription')"
      :dirty="renameDialog.dirty"
      :error="renameDialog.error"
      mode="edit"
      :submitting="renameDialog.submitting"
      :title="t('projects.renameTitle')"
      @submit="rename"
    >
      <DlTextField
        :error="renameDialog.attempted && !renameDialog.form.name.trim() ? t('common.enterName') : null"
        :label="t('common.name')"
        :model-value="renameDialog.form.name"
        required
        @update:model-value="value => (renameDialog.form.name = asText(value))"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="statusChange.open"
      :confirm-label="statusChange.target === 'ACTIVE' ? t('project.activateProject') : t('project.suspendProject')"
      :destructive="statusChange.target === 'SUSPENDED'"
      :error="statusChange.error"
      :message="statusChange.target === 'ACTIVE' ? t('project.activateMessage') : t('project.suspendMessage')"
      :processing="statusChange.processing"
      :title="statusChange.target === 'ACTIVE' ? t('project.activateTitle', { name: title }) : t('project.suspendTitle', { name: title })"
      @confirm="applyStatus"
    />

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('projects.deleteTitle')"
      destructive
      :error="removal.error"
      :message="t('projects.deleteMessage')"
      :processing="removal.processing"
      :require-text="removal.target?.name ?? null"
      :title="t('projects.deleteTitle')"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Project, ProjectStatus } from '@/types/sso'
  import {
    type DescriptionItem,
    DlButton,
    DlConfirmDialog,
    DlDescriptionList,
    DlEmptyState,
    DlFormDialog,
    DlPageHeader,
    DlSectionCard,
    DlSkeleton,
    DlStatusChip,
    DlTabs,
    DlTextField,
    type HeaderAction,
    type TabItem,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import ClientKeysPanel from '@/components/ClientKeysPanel.vue'
  import ActivationChecklist from '@/components/project/ActivationChecklist.vue'
  import MembersPanel from '@/components/project/MembersPanel.vue'
  import RedirectUrisPanel from '@/components/project/RedirectUrisPanel.vue'
  import RolesPanel from '@/components/project/RolesPanel.vue'
  import RoutesPanel from '@/components/project/RoutesPanel.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { PROJECT_STATUS } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useCatalogStore } from '@/stores/catalog'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { formatDate, formatDateTime, keyState, queryString } from '@/utils/format'
  import { asText } from '@/utils/forms'

  /**
   * Um projeto e tudo o que ele precisa para funcionar, na ordem do fluxo:
   * identidade, redirect URIs, rotas, papeis e permissoes, membros e chaves.
   *
   * O overview, que alimenta as abas de gestao, exige papel de administracao.
   * Quem so le o catalogo ve a identidade e mais nada, e as abas somem juntas.
   */
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const projects = useProjectsStore()

  const projectId = computed(() => String(route.params.id))

  const project = computed(() => projects.projects[projectId.value] ?? null)

  /** O projeto do proprio SSO: nao se renomeia, nao se suspende e nao se apaga. */
  const isSelf = computed(() => project.value?.name === SELF_PROJECT_NAME)
  const overview = computed(() => projects.overviews[projectId.value] ?? null)

  const overviewPath = computed(() => `/project/${projectId.value}/overview`)
  const canOverview = computed(() => session.can('GET', overviewPath.value))

  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function load (): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      await projects.refresh(projectId.value, canOverview.value)
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  /** A aba mora na URL: recarregar ou compartilhar o link volta ao mesmo lugar. */
  const tab = computed({
    get: () => queryString(route.query.tab) ?? 'overview',
    set: value => {
      const { route: path, ...others } = route.query

      // O caminho escolhido so vale na aba de rotas. Levado para outra aba,
      // reabriria um detalhe na volta sem ninguem ter pedido.
      void router.replace({ query: value === 'routes' ? { ...others, route: path, tab: value } : { ...others, tab: value } })
    },
  })

  const title = computed(() => project.value?.name ?? t('pageTitles.project'))

  const headerDescription = computed(() =>
    project.value
      ? t('project.headerDescription', { status: PROJECT_STATUS[project.value.status].label, date: formatDate(project.value.createdAt) })
      : undefined,
  )

  const tabs = computed<TabItem[]>(() => {
    const permission = { method: 'GET', path: overviewPath.value }
    const current = overview.value

    return [
      { key: 'overview', label: t('project.tabs.overview'), icon: 'mdi-information-outline' },
      { key: 'redirects', label: t('project.tabs.redirects'), icon: 'mdi-link-variant', count: current?.redirectUriRecords.length, permission },
      { key: 'routes', label: t('project.tabs.routes'), icon: 'mdi-sitemap-outline', count: current?.routes.length, permission },
      { key: 'roles', label: t('project.tabs.roles'), icon: 'mdi-shield-account-outline', count: current?.roles.length, permission },
      { key: 'members', label: t('project.tabs.members'), icon: 'mdi-account-multiple-outline', count: current?.users.length, permission },
      {
        key: 'keys',
        label: t('project.tabs.keys'),
        icon: 'mdi-key-variant',
        count: current?.clientKeys.filter(key => keyState(key) === 'ACTIVE').length,
        permission: { method: 'GET', path: '/clientkey' },
      },
    ]
  })

  const identityItems = computed<DescriptionItem[]>(() => {
    const current = project.value

    if (!current) {
      return []
    }

    return [
      { key: 'name', label: t('common.name'), value: current.name },
      { key: 'status', label: t('common.status'), value: current.status },
      {
        key: 'clientId',
        label: t('common.clientId'),
        value: current.clientId,
        mono: true,
        copyable: true,
        hint: t('project.identity.clientIdHint'),
      },
      { key: 'createdAt', label: t('common.registered'), value: formatDateTime(current.createdAt) },
      { key: 'activatedAt', label: t('project.identity.lastActivated'), value: current.activatedAt ? formatDateTime(current.activatedAt) : null },
      { key: 'suspendedAt', label: t('project.identity.lastSuspended'), value: current.suspendedAt ? formatDateTime(current.suspendedAt) : null },
    ]
  })

  const headerActions = computed<HeaderAction[]>(() => {
    const current = project.value

    if (!current) {
      return []
    }

    const statusPath = `/project/${current.id}/status`
    const activate: HeaderAction = { key: 'activate', label: t('project.activate'), icon: 'mdi-play-circle-outline', method: 'PATCH', path: statusPath, color: 'success' }

    // O servidor recusa renomear, suspender e apagar o projeto do proprio SSO; a tela nem oferece.
    if (isSelf.value) {
      return current.status === 'ACTIVE' ? [] : [activate]
    }

    return [
      current.status === 'ACTIVE'
        ? { key: 'suspend', label: t('project.suspend'), icon: 'mdi-pause-circle-outline', method: 'PATCH', path: statusPath, color: 'warning', variant: 'tonal' }
        : activate,
      { key: 'rename', label: t('common.rename'), icon: 'mdi-pencil-outline', method: 'PUT', path: `/project/${current.id}`, variant: 'outlined' },
      { key: 'delete', label: t('common.delete'), icon: 'mdi-delete-outline', method: 'DELETE', path: `/project/${current.id}`, color: 'error', variant: 'text' },
    ]
  })

  const renameDialog = useCrudDialog(() => ({ name: '' }))
  const statusChange = useConfirm<ProjectStatus>()
  const removal = useConfirm<Project>()

  function onAction (key: string): void {
    const current = project.value

    if (!current) {
      return
    }

    switch (key) {
      case 'activate': {
        statusChange.ask('ACTIVE')

        break
      }
      case 'suspend': {
        statusChange.ask('SUSPENDED')

        break
      }
      case 'rename': {
        renameDialog.openEdit(current.id, { name: current.name })

        break
      }
      case 'delete': {
        removal.ask(current)

        break
      }
    // No default
    }
  }

  async function rename (): Promise<void> {
    const name = renameDialog.form.name.trim()

    const ok = await renameDialog.submit(!!name, () => projects.rename(projectId.value, name))

    if (ok) {
      toast.success(t('projects.renamed'))
    }
  }

  async function applyStatus (): Promise<void> {
    const ok = await statusChange.confirm(status => projects.setStatus(projectId.value, status, canOverview.value))

    if (ok) {
      toast.success(statusChange.target === 'ACTIVE' ? t('project.activated') : t('project.suspended'))
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(async current => {
      await projects.remove(current.id)
      await catalog.ensure('projects', true).catch(() => {})
    })

    if (ok) {
      toast.success(t('projects.deleted'))
      await router.replace({ name: 'projects' })
    }
  }
</script>
