<template>
  <DlSectionCard
    :count="rows.length"
    :description="t('members.description')"
    :padded="rows.length === 0"
    :title="t('members.title')"
  >
    <template v-if="canAdd" #actions>
      <DlButton
        :disabled="project.roles.length === 0"
        icon="mdi-account-plus-outline"
        variant="tonal"
        @click="openAdd"
      >
        {{ t('members.add') }}
      </DlButton>
    </template>

    <DlEmptyState
      v-if="rows.length === 0"
      compact
      :description="project.roles.length > 0 ? t('members.emptyDescription') : t('members.emptyNoRoles')"
      icon="mdi-account-multiple-outline"
      :title="t('members.emptyTitle')"
    />

    <DlDataTable
      v-else
      :actions="actions"
      bare
      :columns="columns"
      :limit="rows.length + 1"
      :rows="rows"
      @action="onAction"
      @row-click="open"
    >
      <template #col-role="{ row }">
        <DlStatusChip :map="ROLE_STATUS" :status="String(row.role)" />
      </template>
    </DlDataTable>

    <template v-if="footerNote" #footer>
      {{ footerNote }}
    </template>
  </DlSectionCard>

  <DlFormDialog
    v-model="dialog.open"
    :description="t('members.addDescription', { project: project.name })"
    :dirty="dialog.dirty"
    :error="dialog.error"
    mode="create"
    :submit-label="t('members.add')"
    :submitting="dialog.submitting"
    :title="t('members.add')"
    @submit="save"
  >
    <DlSelect
      :error="dialog.attempted && !dialog.form.userId ? t('members.choosePerson') : null"
      :hint="t('members.personHint')"
      :label="t('members.person')"
      :loading="catalog.state.users.loading"
      :model-value="dialog.form.userId || null"
      :options="userOptions"
      required
      searchable
      @update:model-value="value => (dialog.form.userId = asOption(value) ?? '')"
    />

    <DlSelect
      :error="dialog.attempted && !dialog.form.roleId ? t('common.chooseRole') : null"
      :label="t('common.role')"
      :model-value="dialog.form.roleId || null"
      :options="roleOptions"
      required
      @update:model-value="value => (dialog.form.roleId = asOption(value) ?? '')"
    />
  </DlFormDialog>

  <DlFormDialog
    v-model="roleDialog.open"
    :description="roleChangeNote"
    :dirty="roleDialog.dirty"
    :error="roleDialog.error"
    mode="edit"
    :submit-label="t('members.changeRole')"
    :submitting="roleDialog.submitting"
    :title="t('members.changeRoleTitle', { name: roleDialog.form.name })"
    @submit="saveRole"
  >
    <DlSelect
      :clearable="false"
      :error="roleDialog.attempted && !roleDialog.form.roleId ? t('common.chooseRole') : null"
      :label="t('common.role')"
      :model-value="roleDialog.form.roleId || null"
      :options="roleOptions"
      required
      @update:model-value="value => (roleDialog.form.roleId = asOption(value) ?? '')"
    />
  </DlFormDialog>

  <DlConfirmDialog
    v-model="removal.open"
    :confirm-label="t('members.remove')"
    destructive
    :error="removal.error"
    :message="removalMessage"
    :processing="removal.processing"
    :title="removal.target ? t('members.removeTitle', { name: removal.target.name }) : t('members.remove')"
    @confirm="remove"
  />
</template>

<script lang="ts" setup>
  import type { ProjectOverview } from '@/types/sso'
  import {
    type Column,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlEmptyState,
    DlFormDialog,
    DlSectionCard,
    DlSelect,
    DlStatusChip,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { ROLE_STATUS, ROOT_ROLE_NAME } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useCatalogStore } from '@/stores/catalog'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { asOption } from '@/utils/forms'
  import { roleLabel, sortRoles } from '@/utils/routes'

  /**
   * Quem entra na aplicacao, com qual papel. Um papel por pessoa por projeto:
   * trocar substitui o anterior, e tirar do projeto revoga os refresh tokens
   * da pessoa ali.
   *
   * No projeto `SSO`, vincular alguem e dar poder administrativo, entao so a
   * raiz mexe nos membros, e o ultimo SUPERADMIN nao troca de papel nem sai.
   */
  const props = defineProps<{ project: ProjectOverview }>()

  const { t } = useI18n()
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const projects = useProjectsStore()

  const isSelf = computed(() => props.project.name === SELF_PROJECT_NAME)

  /** Membros do SSO so a raiz muda. O servidor recusa os outros; a tela nem oferece. */
  const locked = computed(() => isSelf.value && !session.root)

  const canAdd = computed(() => !locked.value && session.can('POST', '/projectuser') && session.can('GET', '/user'))

  interface MemberRow extends Record<string, unknown> {
    id: string
    name: string
    email: string
    role: string
    routes: string
  }

  const rows = computed<MemberRow[]>(() =>
    props.project.users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      routes: t('counts.routes', user.grantedRoutes),
    })),
  )

  const columns = computed<Column<MemberRow>[]>(() => [
    { key: 'name', label: t('common.name') },
    { key: 'email', label: t('common.email'), secondary: true },
    { key: 'role', label: t('common.role'), width: '150px' },
    { key: 'routes', label: t('members.granted'), width: '120px', align: 'end' },
  ])

  const rootCount = computed(() => props.project.users.filter(user => user.role === ROOT_ROLE_NAME).length)

  /** O SSO nunca fica sem SUPERADMIN. O servidor recusa; a tela deixa a acao indisponivel. */
  const isLastRoot = (row: MemberRow): boolean => isSelf.value && row.role === ROOT_ROLE_NAME && rootCount.value <= 1

  const actions = computed<RowAction<MemberRow>[]>(() => (locked.value
    ? []
    : [
      {
        key: 'role',
        label: t('members.changeRole'),
        icon: 'mdi-account-convert-outline',
        method: 'PUT',
        path: '/projectuser/:projectId/:userId',
        unavailable: row => isLastRoot(row) || props.project.roles.length < 2,
      },
      {
        key: 'remove',
        label: t('members.removeFromProject'),
        icon: 'mdi-account-remove-outline',
        method: 'DELETE',
        path: '/projectuser/:projectId/:userId',
        color: 'error',
        unavailable: isLastRoot,
      },
    ]))

  const footerNote = computed(() => {
    if (rows.value.length === 0) {
      return null
    }

    if (locked.value) {
      return t('members.lockedNote')
    }

    return isSelf.value ? t('members.lastRootNote') : null
  })

  const userOptions = computed(() =>
    catalog.users
      .filter(user => !props.project.users.some(member => member.id === user.id))
      .map(user => ({ title: `${user.name} · ${user.email}`, value: user.id })),
  )

  const roleOptions = computed(() =>
    sortRoles(props.project.roles).map(role => ({ title: roleLabel(role.name), value: role.id })),
  )

  const roleIdOf = (name: string): string => props.project.roles.find(role => role.name === name)?.id ?? ''

  const roleNameOf = (roleId: string): string => props.project.roles.find(role => role.id === roleId)?.name ?? ''

  const isYou = (row: MemberRow): boolean => row.id === session.me?.id

  /* -------------------------------- adicionar -------------------------------- */

  const dialog = useCrudDialog(() => ({ userId: '', roleId: '' }))

  async function openAdd (): Promise<void> {
    dialog.openCreate()

    try {
      await catalog.ensure('users')
    } catch (error) {
      toast.error(t('members.peopleLoadFailed'), { description: errorMessage(error) })
    }
  }

  async function save (): Promise<void> {
    const { userId, roleId } = dialog.form

    const ok = await dialog.submit(!!userId && !!roleId, () => projects.addMember(props.project.id, userId, roleId))

    if (ok) {
      toast.success(t('members.added'))
    }
  }

  /* ------------------------------ trocar papel ------------------------------ */

  const roleDialog = useCrudDialog(() => ({ name: '', roleId: '' }))

  const roleChangeNote = computed(() =>
    isSelf.value
      ? t('members.changeNoteSelf')
      : t('members.changeNote'),
  )

  async function saveRole (): Promise<void> {
    const userId = roleDialog.targetId
    const { name, roleId } = roleDialog.form

    const ok = await roleDialog.submit(!!userId && !!roleId, async () => {
      if (userId) {
        await projects.changeMemberRole(props.project.id, userId, roleId)
      }
    })

    if (ok) {
      toast.success(t('members.roleChanged'), {
        description: t('members.roleChangedDescription', { name, role: roleLabel(roleNameOf(roleId)), project: props.project.name }),
      })
    }
  }

  /* --------------------------------- remover --------------------------------- */

  const removal = useConfirm<MemberRow>()

  const removalMessage = computed(() => {
    const target = removal.target

    if (!target) {
      return ''
    }

    if (isSelf.value && isYou(target)) {
      return t('members.removeSelf')
    }

    if (isSelf.value) {
      return t('members.removeFromSso', { name: target.name })
    }

    return t('members.removeMessage', { name: target.name, project: props.project.name })
  })

  async function remove (): Promise<void> {
    const target = removal.target

    const ok = await removal.confirm(row => projects.removeMember(props.project.id, row.id))

    if (!ok || !target) {
      return
    }

    toast.success(t('members.removed'), { description: t('members.removedDescription', { name: target.name, project: props.project.name }) })

    // Quem tirou a si mesmo do SSO perde o console agora: o guard leva a tela de sem acesso.
    if (isSelf.value && isYou(target)) {
      await session.refresh()
      await router.replace('/')
    }
  }

  function onAction (key: string, row: MemberRow): void {
    if (key === 'role') {
      roleDialog.openEdit(row.id, { name: row.name, roleId: roleIdOf(row.role) })
    } else if (key === 'remove') {
      removal.ask(row)
    }
  }

  function open (row: MemberRow): void {
    if (session.can('GET', `/user/${row.id}`)) {
      void router.push({ name: 'user', params: { id: row.id } })
    }
  }
</script>
