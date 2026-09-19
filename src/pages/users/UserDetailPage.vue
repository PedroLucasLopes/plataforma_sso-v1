<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.users'), to: '/users' }, { label: title }]"
      :description="user?.email"
      :title="title"
      :with-menu="false"
      @action="onAction"
      @navigate="to => router.push(to)"
    />

    <DlSkeleton v-if="loading && !user" height="220px" variant="block" />

    <DlEmptyState
      v-else-if="loadError && !user"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      :title="t('user.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <template v-else-if="user">
      <DlSectionCard :description="t('user.profile.description')" :title="t('user.profile.title')">
        <DlDescriptionList :items="profileItems">
          <template #item-googleAccount>
            <DlStatusChip :map="LINK_STATUS" size="default" :status="linkState" />
          </template>
        </DlDescriptionList>
      </DlSectionCard>

      <DlSectionCard
        :count="memberships.length"
        :description="t('user.projects.description')"
        :padded="memberships.length === 0"
        :title="t('common.projects')"
      >
        <template v-if="canAddMembership" #actions>
          <DlButton icon="mdi-plus" variant="tonal" @click="openMembership">{{ t('user.addToProject') }}</DlButton>
        </template>

        <DlEmptyState
          v-if="memberships.length === 0"
          compact
          :description="t('user.projects.emptyDescription')"
          icon="mdi-apps"
          :title="t('user.projects.emptyTitle')"
        />

        <DlDataTable
          v-else
          bare
          :columns="membershipColumns"
          :limit="memberships.length + 1"
          :rows="memberships"
          @row-click="row => router.push({ name: 'project', params: { id: row.id } })"
        >
          <template #col-role="{ row }">
            <DlStatusChip :map="roleMap" :status="String(row.role)" />
          </template>

          <template #col-status="{ row }">
            <DlStatusChip :map="PROJECT_STATUS" :status="String(row.status)" />
          </template>
        </DlDataTable>
      </DlSectionCard>
    </template>

    <DlFormDialog
      v-model="editDialog.open"
      :dirty="editDialog.dirty"
      :error="editDialog.error"
      mode="edit"
      :submitting="editDialog.submitting"
      :title="t('users.editTitle')"
      @submit="saveEdit"
    >
      <DlTextField
        :error="editDialog.attempted && !editDialog.form.name.trim() ? t('common.enterName') : null"
        :label="t('common.name')"
        :model-value="editDialog.form.name"
        required
        @update:model-value="value => (editDialog.form.name = asText(value))"
      />

      <DlTextField
        :error="editDialog.attempted && !EMAIL_PATTERN.test(editDialog.form.email.trim()) ? t('common.enterEmail') : null"
        :hint="t('common.googleEmailHint')"
        :label="t('common.email')"
        :model-value="editDialog.form.email"
        required
        type="email"
        @update:model-value="value => (editDialog.form.email = asText(value))"
      />
    </DlFormDialog>

    <DlFormDialog
      v-model="membership.open"
      :description="t('user.addDescription', { name: title })"
      :dirty="membership.dirty"
      :error="membership.error"
      mode="create"
      :submit-label="t('user.addToProject')"
      :submitting="membership.submitting"
      :title="t('user.addToProject')"
      @submit="saveMembership"
    >
      <DlSelect
        :error="membership.attempted && !membership.form.projectId ? t('common.chooseProject') : null"
        :label="t('common.project')"
        :loading="catalog.state.projects.loading"
        :model-value="membership.form.projectId || null"
        :options="projectOptions"
        required
        @update:model-value="value => selectProject(asOption(value) ?? '')"
      />

      <DlSelect
        :disabled="!membership.form.projectId"
        :error="membership.attempted && !membership.form.roleId ? t('common.chooseRole') : null"
        :hint="membership.form.projectId && !rolesLoading && roleOptions.length === 0 ? t('user.noRoles') : undefined"
        :label="t('common.role')"
        :loading="rolesLoading"
        :model-value="membership.form.roleId || null"
        :options="roleOptions"
        required
        @update:model-value="value => (membership.form.roleId = asOption(value) ?? '')"
      />
    </DlFormDialog>

    <DlConfirmDialog
      v-model="unlink.open"
      :confirm-label="t('user.unlinkConfirm')"
      :error="unlink.error"
      :message="t('user.unlinkMessage')"
      :processing="unlink.processing"
      :title="t('user.unlink')"
      @confirm="applyUnlink"
    />

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('users.deleteTitle')"
      destructive
      :error="removal.error"
      :message="t('users.deleteMessage', { name: title })"
      :processing="removal.processing"
      :title="t('users.deleteTitle')"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import {
    type Column,
    type DescriptionItem,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlDescriptionList,
    DlEmptyState,
    DlFormDialog,
    DlPageHeader,
    DlSectionCard,
    DlSelect,
    DlSkeleton,
    DlStatusChip,
    DlTextField,
    type HeaderAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { LINK_STATUS, type LinkState, PROJECT_STATUS } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useCatalogStore } from '@/stores/catalog'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { useUsersStore } from '@/stores/users'
  import { asOption, asText, EMAIL_PATTERN } from '@/utils/forms'
  import { roleChips, roleLabel, sortRoles } from '@/utils/routes'

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const projects = useProjectsStore()
  const users = useUsersStore()

  const userId = computed(() => String(route.params.id))
  const user = computed(() => (users.current?.id === userId.value ? users.current : null))

  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function load (): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      await users.fetchOne(userId.value)
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  const title = computed(() => user.value?.name ?? t('pageTitles.user'))
  const linkState = computed<LinkState>(() => (user.value?.authId ? 'LINKED' : 'WAITING'))

  const profileItems = computed<DescriptionItem[]>(() => {
    const current = user.value

    if (!current) {
      return []
    }

    return [
      { key: 'name', label: t('common.name'), value: current.name },
      { key: 'email', label: t('common.email'), value: current.email, copyable: true },
      {
        key: 'googleAccount',
        label: t('users.googleAccount'),
        value: linkState.value,
        hint: current.authId
          ? t('user.linkedHint')
          : t('user.waitingHint'),
      },
      { key: 'id', label: t('user.userId'), value: current.id, mono: true, copyable: true },
    ]
  })

  interface MembershipRow extends Record<string, unknown> {
    id: string
    project: string
    role: string
    status: string
  }

  const memberships = computed<MembershipRow[]>(() =>
    (user.value?.projectUsers ?? []).map(link => ({
      id: link.project.id,
      project: link.project.name,
      role: link.role.name ?? '—',
      status: link.project.status,
    })),
  )

  const roleMap = computed(() => roleChips(memberships.value.map(row => row.role)))

  const membershipColumns = computed<Column<MembershipRow>[]>(() => [
    { key: 'project', label: t('common.project') },
    { key: 'role', label: t('common.role'), width: '150px' },
    { key: 'status', label: t('user.projectStatus'), width: '170px' },
  ])

  const headerActions = computed<HeaderAction[]>(() => {
    const current = user.value

    if (!current) {
      return []
    }

    const path = `/user/${current.id}`
    const actions: HeaderAction[] = [
      { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path, variant: 'outlined' },
    ]

    if (current.authId) {
      actions.push({ key: 'unlink', label: t('user.unlink'), icon: 'mdi-link-variant-off', method: 'PUT', path, variant: 'text' })
    }

    // Com acesso a algum projeto o SSO recusa apagar. O vinculo sai antes, na
    // aba de membros do projeto; ate la, o botao so criaria um erro garantido.
    if (memberships.value.length === 0) {
      actions.push({ key: 'delete', label: t('common.delete'), icon: 'mdi-delete-outline', method: 'DELETE', path, color: 'error', variant: 'text' })
    }

    return actions
  })

  const editDialog = useCrudDialog(() => ({ name: '', email: '' }))
  const membership = useCrudDialog(() => ({ projectId: '', roleId: '' }))
  const unlink = useConfirm<string>()
  const removal = useConfirm<string>()

  function onAction (key: string): void {
    const current = user.value

    if (!current) {
      return
    }

    switch (key) {
      case 'edit': {
        editDialog.openEdit(current.id, { name: current.name, email: current.email })

        break
      }
      case 'unlink': {
        unlink.ask(current.id)

        break
      }
      case 'delete': {
        removal.ask(current.id)

        break
      }
    // No default
    }
  }

  async function saveEdit (): Promise<void> {
    const input = { name: editDialog.form.name.trim(), email: editDialog.form.email.trim().toLowerCase() }

    const ok = await editDialog.submit(!!input.name && EMAIL_PATTERN.test(input.email), () => users.update(userId.value, input))

    if (ok) {
      toast.success(t('users.updated'))
    }
  }

  /* ------------------------------ projetos ------------------------------ */

  /** Os papeis vem do overview do projeto escolhido: a tela nunca busca os papeis de todos os projetos. */
  const canAddMembership = computed(() =>
    session.can('POST', '/projectuser') && session.can('GET', '/project') && session.can('GET', '/project/:id/overview'),
  )

  /** Colocar alguem no projeto `SSO` e dar poder administrativo: so a raiz. */
  const projectOptions = computed(() =>
    catalog.projects
      .filter(project => !memberships.value.some(row => row.id === project.id))
      .filter(project => session.root || project.name !== SELF_PROJECT_NAME)
      .map(project => ({ title: project.name, value: project.id })),
  )

  const roleOptions = computed(() =>
    sortRoles(projects.overviews[membership.form.projectId]?.roles ?? [])
      .map(role => ({ title: roleLabel(role.name), value: role.id })),
  )

  const rolesLoading = ref(false)

  /** Ultima escolha de projeto: a resposta de uma escolha anterior nao encerra o carregamento da atual. */
  let selection = 0

  async function selectProject (projectId: string): Promise<void> {
    membership.form.projectId = projectId
    membership.form.roleId = ''

    if (!projectId) {
      return
    }

    selection += 1

    const current = selection

    rolesLoading.value = true

    try {
      await projects.fetchOverview(projectId)
    } catch (error) {
      toast.error(t('user.rolesLoadFailed'), { description: errorMessage(error) })
    } finally {
      if (current === selection) {
        rolesLoading.value = false
      }
    }
  }

  async function openMembership (): Promise<void> {
    membership.openCreate()

    try {
      await catalog.ensure('projects')
    } catch (error) {
      toast.error(t('common.projectsLoadFailed'), { description: errorMessage(error) })
    }
  }

  async function saveMembership (): Promise<void> {
    const { projectId, roleId } = membership.form

    const ok = await membership.submit(!!projectId && !!roleId, () => users.addMembership(userId.value, projectId, roleId))

    if (ok) {
      toast.success(t('user.added'))
    }
  }

  async function applyUnlink (): Promise<void> {
    const ok = await unlink.confirm(id => users.update(id, { authId: null }))

    if (ok) {
      toast.success(t('user.unlinked'), { description: t('user.unlinkedDescription') })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(id => users.remove(id))

    if (ok) {
      toast.success(t('users.deleted'))
      await router.replace({ name: 'users' })
    }
  }
</script>
