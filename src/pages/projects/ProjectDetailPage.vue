<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: 'Projects', to: '/projects' }, { label: title }]"
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
      title="The project could not be loaded"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">Try again</DlButton>
    </DlEmptyState>

    <DlTabs v-else-if="project" v-model="tab" :tabs="tabs">
      <template #overview>
        <DlSectionCard description="How applications and people identify this project." title="Identity">
          <DlDescriptionList :items="identityItems">
            <template #item-status>
              <DlStatusChip :map="PROJECT_STATUS" size="default" :status="project.status" />
            </template>
          </DlDescriptionList>

          <template v-if="isSelf" #footer>
            This is the SSO's own project: it signs in the administrators of every application. It cannot be
            renamed, suspended or deleted, and its routes, roles and permissions change only through
            scripts/bootstrap-sso.js.
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
      description="The name appears on the sign-in screen, as the application people are signing in to."
      :dirty="renameDialog.dirty"
      :error="renameDialog.error"
      mode="edit"
      :submitting="renameDialog.submitting"
      title="Rename project"
      @submit="rename"
    >
      <DlTextField
        :error="renameDialog.attempted && !renameDialog.form.name.trim() ? 'Enter a name.' : null"
        label="Name"
        :model-value="renameDialog.form.name"
        required
        @update:model-value="value => (renameDialog.form.name = asText(value))"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="statusChange.open"
      :confirm-label="statusChange.target === 'ACTIVE' ? 'Activate project' : 'Suspend project'"
      :destructive="statusChange.target === 'SUSPENDED'"
      :error="statusChange.error"
      :message="statusChange.target === 'ACTIVE'
        ? 'Applications with this client ID can start signing people in right away.'
        : 'Every application with this client ID stops signing people in, and refresh tokens stop renewing. The catalogue stays as it is.'"
      :processing="statusChange.processing"
      :title="statusChange.target === 'ACTIVE' ? `Activate ${title}?` : `Suspend ${title}?`"
      @confirm="applyStatus"
    />

    <DlConfirmDialog
      v-model="removal.open"
      confirm-label="Delete project"
      destructive
      :error="removal.error"
      message="The project leaves the catalogue with its identity. The SSO refuses while it still has routes or members."
      :processing="removal.processing"
      :require-text="removal.target?.name ?? null"
      title="Delete project"
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

  const title = computed(() => project.value?.name ?? 'Project')

  const headerDescription = computed(() =>
    project.value
      ? `${PROJECT_STATUS[project.value.status].label} · registered ${formatDate(project.value.createdAt)}`
      : undefined,
  )

  const tabs = computed<TabItem[]>(() => {
    const permission = { method: 'GET', path: overviewPath.value }
    const current = overview.value

    return [
      { key: 'overview', label: 'Overview', icon: 'mdi-information-outline' },
      { key: 'redirects', label: 'Redirect URIs', icon: 'mdi-link-variant', count: current?.redirectUriRecords.length, permission },
      { key: 'routes', label: 'Routes', icon: 'mdi-sitemap-outline', count: current?.routes.length, permission },
      { key: 'roles', label: 'Roles & permissions', icon: 'mdi-shield-account-outline', count: current?.roles.length, permission },
      { key: 'members', label: 'Members', icon: 'mdi-account-multiple-outline', count: current?.users.length, permission },
      {
        key: 'keys',
        label: 'Client keys',
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
      { key: 'name', label: 'Name', value: current.name },
      { key: 'status', label: 'Status', value: current.status },
      {
        key: 'clientId',
        label: 'Client ID',
        value: current.clientId,
        mono: true,
        copyable: true,
        hint: 'Public identifier. Applications send it as client_id; the proof is their private key.',
      },
      { key: 'createdAt', label: 'Registered', value: formatDateTime(current.createdAt) },
      { key: 'activatedAt', label: 'Last activated', value: current.activatedAt ? formatDateTime(current.activatedAt) : null },
      { key: 'suspendedAt', label: 'Last suspended', value: current.suspendedAt ? formatDateTime(current.suspendedAt) : null },
    ]
  })

  const headerActions = computed<HeaderAction[]>(() => {
    const current = project.value

    if (!current) {
      return []
    }

    const statusPath = `/project/${current.id}/status`
    const activate: HeaderAction = { key: 'activate', label: 'Activate', icon: 'mdi-play-circle-outline', method: 'PATCH', path: statusPath, color: 'success' }

    // O servidor recusa renomear, suspender e apagar o projeto do proprio SSO; a tela nem oferece.
    if (isSelf.value) {
      return current.status === 'ACTIVE' ? [] : [activate]
    }

    return [
      current.status === 'ACTIVE'
        ? { key: 'suspend', label: 'Suspend', icon: 'mdi-pause-circle-outline', method: 'PATCH', path: statusPath, color: 'warning', variant: 'tonal' }
        : activate,
      { key: 'rename', label: 'Rename', icon: 'mdi-pencil-outline', method: 'PUT', path: `/project/${current.id}`, variant: 'outlined' },
      { key: 'delete', label: 'Delete', icon: 'mdi-delete-outline', method: 'DELETE', path: `/project/${current.id}`, color: 'error', variant: 'text' },
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
      toast.success('Project renamed')
    }
  }

  async function applyStatus (): Promise<void> {
    const ok = await statusChange.confirm(status => projects.setStatus(projectId.value, status, canOverview.value))

    if (ok) {
      toast.success(statusChange.target === 'ACTIVE' ? 'Project activated' : 'Project suspended')
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(async current => {
      await projects.remove(current.id)
      await catalog.ensure('projects', true).catch(() => {})
    })

    if (ok) {
      toast.success('Project deleted')
      await router.replace({ name: 'projects' })
    }
  }
</script>
