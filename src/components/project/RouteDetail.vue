<template>
  <DlSectionCard :title="node.key">
    <template #title>
      <DlRoutePath :path="node.key" size="large" />
    </template>

    <template v-if="canCreate" #actions>
      <DlButton
        v-if="node.group"
        icon="mdi-plus"
        size="small"
        variant="tonal"
        @click="emit('create', { path: node.key })"
      >
        {{ t('routeDetail.registerPath') }}
      </DlButton>

      <DlButton
        v-else-if="missingMethods.length > 0"
        icon="mdi-plus"
        size="small"
        variant="tonal"
        @click="addMethod"
      >
        {{ t('routeDetail.addMethod') }}
      </DlButton>

      <DlButton
        icon="mdi-source-branch-plus"
        size="small"
        variant="outlined"
        @click="emit('create', { path: childPrefix })"
      >
        {{ t('routeDetail.addSubRoute') }}
      </DlButton>
    </template>

    <p v-if="node.group" class="route-detail__lead">
      {{ t('routeDetail.groupLead', node.descendants) }}
    </p>

    <div v-else class="route-detail__methods">
      <DlStatusChip
        v-for="item in node.routes"
        :key="item.id"
        :map="METHOD_STATUS"
        size="default"
        :status="item.method"
        :with-icon="false"
      />
    </div>

    <DlDescriptionList :items="facts">
      <template #item-params>
        <span v-if="params.length === 0">—</span>

        <span v-else class="route-detail__params">
          <code v-for="param in params" :key="param" class="route-detail__param">:{{ param }}</code>
        </span>
      </template>

      <template #item-parent>
        <button
          v-if="parentKey"
          class="route-detail__link"
          type="button"
          @click="openParent"
        >
          <DlRoutePath :path="parentKey" />
        </button>

        <span v-else>{{ t('routeDetail.topLevel') }}</span>
      </template>
    </DlDescriptionList>
  </DlSectionCard>

  <DlSectionCard
    v-if="!node.group"
    :description="t('routeDetail.access.description')"
    :heading-level="3"
    :padded="roles.length === 0"
    :title="t('routeDetail.access.title')"
  >
    <DlEmptyState
      v-if="roles.length === 0"
      compact
      :description="t('routeDetail.access.emptyDescription')"
      icon="mdi-shield-account-outline"
      :title="t('routeDetail.access.emptyTitle')"
    />

    <DlDataTable
      v-else
      :actions="actions"
      bare
      :columns="accessColumns"
      :limit="accessRows.length + 1"
      :paged="false"
      :rows="accessRows"
      @action="onAction"
    >
      <template #col-method="{ row }">
        <DlStatusChip :map="METHOD_STATUS" :status="String(row.method)" :with-icon="false" />
      </template>

      <template v-for="role in roles" :key="role.id" #[roleSlot(role.id)]="{ row }">
        <span class="route-detail__grant">
          <VCheckbox
            v-if="canManage"
            :aria-label="t('grants.canCall', { role: roleLabel(role.name), method: String(row.method), path: String(row.path) })"
            color="primary"
            density="compact"
            :disabled="isBusy(role.id, String(row.id))"
            hide-details
            :model-value="!!permissionOf(role.id, String(row.id))"
            @update:model-value="checked => toggle(role.id, String(row.id), !!checked)"
          />

          <VIcon
            v-else-if="permissionOf(role.id, String(row.id))"
            :aria-label="t('routeDetail.access.granted')"
            color="success"
            icon="mdi-check"
            size="18"
          />

          <span v-else :aria-label="t('routeDetail.access.notGranted')" class="route-detail__none">—</span>
        </span>
      </template>

      <template #col-callers="{ row }">
        <span :class="{ 'route-detail__nobody': row.callers === 0 }">
          {{ row.callers === 0 ? t('routeDetail.access.nobody') : t('counts.members', Number(row.callers)) }}
        </span>
      </template>
    </DlDataTable>
  </DlSectionCard>

  <DlSectionCard
    v-if="!node.group"
    :count="callers.length"
    :description="t('routeDetail.callers.description')"
    :heading-level="3"
    :padded="callers.length === 0"
    :title="t('routeDetail.callers.title')"
  >
    <DlEmptyState
      v-if="callers.length === 0"
      compact
      :description="granted ? t('routeDetail.callers.emptyGranted') : t('routeDetail.callers.emptyNotGranted')"
      icon="mdi-account-lock-outline"
      :title="t('routeDetail.callers.emptyTitle')"
    >
      <DlButton v-if="granted" icon="mdi-account-multiple-outline" variant="outlined" @click="openMembers">
        {{ t('routeDetail.callers.openMembers') }}
      </DlButton>
    </DlEmptyState>

    <DlDataTable
      v-else
      bare
      :columns="callerColumns"
      :limit="callers.length + 1"
      :paged="false"
      :rows="callers"
      @row-click="openUser"
    >
      <template #col-role="{ row }">
        <DlStatusChip :map="roleMap" :status="String(row.role)" />
      </template>

      <template #col-methods="{ row }">
        <span class="route-detail__chips">
          <DlStatusChip
            v-for="method in row.methods"
            :key="method"
            :map="METHOD_STATUS"
            :status="method"
            :with-icon="false"
          />
        </span>
      </template>
    </DlDataTable>
  </DlSectionCard>

  <DlSectionCard
    v-if="node.children.length > 0"
    :count="node.descendants"
    :description="t('routeDetail.below.description')"
    :heading-level="3"
    :padded="false"
    :title="t('routeDetail.below.title')"
  >
    <DlRouteTree
      :label="t('routeDetail.below.treeLabel', { path: node.key })"
      :nodes="node.children"
      :selected="null"
      @update:selected="openChild"
    />
  </DlSectionCard>
</template>

<script lang="ts" setup>
  import type { HttpMethod, ProjectOverview, RoleName } from '@/types/sso'
  import {
    type Column,
    type DescriptionItem,
    DlButton,
    DlDataTable,
    DlDescriptionList,
    DlEmptyState,
    DlRoutePath,
    DlRouteTree,
    DlSectionCard,
    DlStatusChip,
    routeParams,
    type RouteTreeNode,
    type RowAction,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useGrants } from '@/composables/useGrants'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { HTTP_METHODS, METHOD_STATUS } from '@/constants/status'
  import { useSessionStore } from '@/stores/session'
  import { type ProjectRoute, roleChips, roleLabel, rolesGranted, type RouteEntry, sortRoles } from '@/utils/routes'

  const props = defineProps<{
    project: ProjectOverview
    node: RouteTreeNode<RouteEntry>
    parentKey: string | null
  }>()

  const emit = defineEmits<{
    select: [key: string]
    create: [values: { method?: HttpMethod, path: string }]
    edit: [route: ProjectRoute]
    remove: [route: ProjectRoute]
  }>()

  const { t } = useI18n()
  const router = useRouter()
  const current = useRoute()
  const session = useSessionStore()
  const { canManage, permissionOf, isBusy, toggle } = useGrants(() => props.project)

  const catalogLocked = computed(() => props.project.name === SELF_PROJECT_NAME && !session.root)

  const canCreate = computed(() => !catalogLocked.value && session.can('POST', '/route'))

  const roles = computed(() => sortRoles(props.project.roles))

  const params = computed(() => routeParams(props.node.key))

  const childPrefix = computed(() => (props.node.key === '/' ? '/' : `${props.node.key}/`))

  const missingMethods = computed(() =>
    HTTP_METHODS.filter(method => !props.node.routes.some(item => item.method === method)),
  )

  const facts = computed<DescriptionItem[]>(() => {
    const { node, parentKey } = props

    const items: DescriptionItem[] = [
      { key: 'path', label: t('routeDetail.facts.path'), value: node.key, mono: true, copyable: true },
      { key: 'params', label: t('routeDetail.facts.parameters'), value: params.value.join(', ') || null },
      { key: 'parent', label: t('routeDetail.facts.parent'), value: parentKey ?? t('routeDetail.topLevel') },
      { key: 'below', label: t('routeDetail.facts.pathsBelow'), value: node.descendants > 0 ? t('counts.paths', node.descendants) : t('common.none') },
    ]

    for (const item of node.routes) {
      items.push({ key: `id-${item.id}`, label: t('routeDetail.facts.routeId', { method: item.method }), value: item.id, mono: true, copyable: true })
    }

    return items
  })

  interface AccessRow extends Record<string, unknown> {
    id: string
    method: HttpMethod
    path: string
    granted: boolean
    callers: number
  }

  const accessRows = computed<AccessRow[]>(() =>
    props.node.routes.map(item => {
      const names = new Set(rolesGranted(props.project, item.id).map(role => role.name))

      return {
        id: item.id,
        method: item.method,
        path: item.path,
        granted: names.size > 0,
        callers: props.project.users.filter(user => names.has(user.role)).length,
      }
    }),
  )

  const granted = computed(() => accessRows.value.some(row => row.granted))

  const roleSlot = (roleId: string): string => `col-role-${roleId}`

  const accessColumns = computed<Column<AccessRow>[]>(() => [
    { key: 'method', label: t('routeDetail.access.method'), width: '100px' },
    ...roles.value.map(role => ({ key: `role-${role.id}`, label: roleLabel(role.name), align: 'center' as const })),
    { key: 'callers', label: t('routeDetail.access.canCall'), align: 'end' },
  ])

  const actions = computed<RowAction<AccessRow>[]>(() => [
    {
      key: 'edit',
      label: t('routeDetail.access.editRoute'),
      icon: 'mdi-pencil-outline',
      method: 'PUT',
      path: '/route/:id',
      unavailable: () => catalogLocked.value,
    },
    {
      key: 'delete',
      label: t('routeDetail.access.deleteRoute'),
      icon: 'mdi-delete-outline',
      method: 'DELETE',
      path: '/route/:id',
      color: 'error',
      unavailable: row => catalogLocked.value || row.granted,
    },
  ])

  function onAction (key: string, row: AccessRow): void {
    const target = props.node.routes.find(item => item.id === row.id)

    if (!target) {
      return
    }

    if (key === 'edit') {
      emit('edit', target)
    } else if (key === 'delete') {
      emit('remove', target)
    }
  }

  interface CallerRow extends Record<string, unknown> {
    id: string
    name: string
    email: string
    role: RoleName
    methods: HttpMethod[]
  }

  const roleMap = computed(() => roleChips(props.project.roles.map(role => role.name)))

  const callers = computed<CallerRow[]>(() => {
    const reach = props.node.routes.map(item => ({
      method: item.method,
      roles: new Set(rolesGranted(props.project, item.id).map(role => role.name)),
    }))

    return props.project.users
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        methods: reach.filter(entry => entry.roles.has(user.role)).map(entry => entry.method),
      }))
      .filter(row => row.methods.length > 0)
  })

  const callerColumns = computed<Column<CallerRow>[]>(() => [
    { key: 'name', label: t('common.name') },
    { key: 'email', label: t('common.email'), secondary: true },
    { key: 'role', label: t('common.role'), width: '140px' },
    { key: 'methods', label: t('routeDetail.callers.methods') },
  ])

  function addMethod (): void {
    const [method] = missingMethods.value

    if (method) {
      emit('create', { path: props.node.key, method })
    }
  }

  function openParent (): void {
    if (props.parentKey) {
      emit('select', props.parentKey)
    }
  }

  function openChild (key: string | null): void {
    if (key) {
      emit('select', key)
    }
  }

  function openUser (row: CallerRow): void {
    if (session.can('GET', `/user/${row.id}`)) {
      void router.push({ name: 'user', params: { id: row.id } })
    }
  }

  function openMembers (): void {
    void router.push({ query: { ...current.query, tab: 'members', route: undefined } })
  }
</script>

<style scoped>
.route-detail__methods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}

.route-detail__lead {
  margin: 0 0 18px;
  max-width: 64ch;
  font-size: 14px;
  line-height: 1.55;
  color: var(--dl-on-surface-muted);
}

.route-detail__params {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}

.route-detail__param {
  font-family: var(--dl-font-mono);
  font-size: 13px;
  color: var(--dl-primary);
}

.route-detail__link {
  margin: -2px -6px;
  padding: 2px 6px;
  border: 0;
  border-radius: var(--dl-radius-sm, 6px);
  background: none;
  color: inherit;
  text-align: start;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: var(--dl-outline);
  text-underline-offset: 3px;
}

.route-detail__link:hover {
  background: var(--dl-surface-variant);
  text-decoration-color: currentcolor;
}

.route-detail__link:focus-visible {
  outline: 2px solid var(--dl-primary);
  outline-offset: 1px;
}

.route-detail__grant {
  display: inline-flex;
  justify-content: center;
  min-width: 40px;
}

.route-detail__none {
  color: var(--dl-on-surface-muted);
}

.route-detail__nobody {
  font-weight: 500;
  color: rgb(var(--v-theme-warning));
}

.route-detail__chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
