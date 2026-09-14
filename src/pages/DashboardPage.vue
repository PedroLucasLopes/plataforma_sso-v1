<template>
  <div class="page">
    <DlPageHeader
      description="The state of the SSO catalogue, from what your role can read."
      :title="greeting"
      :with-menu="false"
    />

    <section v-if="stats.length > 0" aria-label="Catalogue totals" class="stats">
      <DlStatCard
        v-for="stat in stats"
        :key="stat.key"
        :hint="stat.hint"
        :icon="stat.icon"
        :interactive="!!stat.to"
        :label="stat.label"
        :loading="stat.loading"
        :tone="stat.tone"
        :value="stat.value"
        @select="stat.to && router.push(stat.to)"
      />
    </section>

    <DlEmptyState
      v-else
      description="Your role opens the console, but does not read any part of the catalogue."
      icon="mdi-eye-off-outline"
      title="Nothing to show yet"
    />

    <section v-if="canProjects" aria-label="Project charts" class="charts">
      <DlChartFrame
        :description="plural(projects.length, 'project')"
        :empty="projectsState.ready && (projects.length === 0 || !!projectsState.error)"
        :empty-message="projectsState.error ?? 'No projects registered yet.'"
        :loading="projectsState.loading"
        :series="statusSeries"
        :table-headers="['Status', 'Projects', 'Share']"
        :table-rows="statusRows"
        title="Projects by status"
      >
        <DlDonutChart :data="statusSlices" total-label="Projects" />

        <template #loading>
          <div class="chart-placeholder">
            <DlSkeleton variant="circle" width="160px" />
          </div>
        </template>
      </DlChartFrame>

      <DlChartFrame
        description="Top 8 by number of members"
        :empty="projectsState.ready && memberBars.length === 0"
        :empty-message="projectsState.error ?? 'No project has members yet.'"
        :loading="projectsState.loading"
        :series="memberSeries"
        :table-headers="['Project', 'Members']"
        :table-rows="memberRows"
        title="Members per project"
      >
        <DlBarChart :data="memberBars" />

        <template #loading>
          <DlSkeleton height="22px" :lines="5" />
        </template>
      </DlChartFrame>

      <DlChartFrame
        class="charts__wide"
        description="Last 12 months"
        :empty="projectsState.ready && (projects.length === 0 || !!projectsState.error)"
        :empty-message="projectsState.error ?? 'No projects registered yet.'"
        :loading="projectsState.loading"
        :series="growthSeries"
        :table-headers="['Month', 'Projects registered']"
        :table-rows="growthRows"
        title="Projects registered"
      >
        <DlAreaChart filled :labels="months.map(month => month.label)" :series="growthSeries" />

        <template #loading>
          <DlSkeleton height="180px" variant="block" />
        </template>
      </DlChartFrame>
    </section>

    <DlSectionCard
      v-if="canProjects"
      :count="pending.length"
      description="Registered in the catalogue, but unable to use the SSO until an administrator activates them."
      :padded="!projectsState.ready || pending.length === 0"
      title="Waiting for activation"
    >
      <DlSkeleton v-if="projectsState.loading" height="36px" :lines="3" />

      <DlEmptyState
        v-else-if="pending.length === 0"
        compact
        description="Every registered project is active, or was suspended on purpose."
        icon="mdi-check-all"
        title="Nothing waiting"
        tone="success"
      />

      <DlDataTable
        v-else
        bare
        :columns="pendingColumns"
        :limit="pending.length + 1"
        :rows="pending"
        @row-click="row => router.push({ name: 'project', params: { id: String(row.id) } })"
      >
        <template #col-status="{ row }">
          <DlStatusChip :map="PROJECT_STATUS" :status="String(row.status)" />
        </template>
      </DlDataTable>
    </DlSectionCard>
  </div>
</template>

<script lang="ts" setup>
  import type { ProjectStatus } from '@/types/sso'
  import {
    type Column,
    DlAreaChart,
    DlBarChart,
    DlChartFrame,
    DlDataTable,
    DlDonutChart,
    DlEmptyState,
    DlPageHeader,
    DlSectionCard,
    DlSkeleton,
    DlStatCard,
    DlStatusChip,
    inferColumns,
    seriesColor,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { LOOKUP_LIMIT, STAT_CARD_MIN_WIDTH } from '@/constants/layout'
  import { PROJECT_STATUS } from '@/constants/status'
  import { toneColor } from '@/constants/theme'
  import { errorMessage } from '@/services/http'
  import { type CatalogKind, useCatalogStore } from '@/stores/catalog'
  import { usePreferencesStore } from '@/stores/preferences'
  import { useSessionStore } from '@/stores/session'
  import { firstName, plural } from '@/utils/format'

  /**
   * Painel de entrada. Cada indicador e grafico so aparece para quem pode ler
   * o recurso de onde ele sai; um cartao com "—" para quem nao pode ver usuarios
   * so apontaria o que a pessoa nao alcanca.
   */
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const preferences = usePreferencesStore()

  const canProjects = computed(() => session.can('GET', '/project'))
  const canUsers = computed(() => session.can('GET', '/user'))
  const canRoutes = computed(() => session.can('GET', '/route'))

  const greeting = computed(() => (session.me ? `Welcome back, ${firstName(session.me.name)}` : 'Overview'))

  const theme = computed(() => (preferences.isDark ? 'dark' : 'light'))

  function stateOf (kind: CatalogKind) {
    const state = catalog.state[kind]

    return {
      loading: state.loading || (!state.loaded && !state.error),
      ready: state.loaded || !!state.error,
      error: state.error,
    }
  }

  const projectsState = computed(() => stateOf('projects'))
  const projects = computed(() => catalog.projects)

  /** O catalogo vem com teto. No teto, o numero exato e desconhecido e a tela diz isso. */
  const count = (length: number): number | string => (length >= LOOKUP_LIMIT ? `${LOOKUP_LIMIT}+` : length)

  interface Stat {
    key: string
    label: string
    value: number | string | null
    icon: string
    tone: 'primary' | 'success' | 'info' | 'neutral'
    hint?: string
    loading: boolean
    to?: string
  }

  const stats = computed<Stat[]>(() => {
    const list: Stat[] = []

    if (canProjects.value) {
      const waiting = projects.value.filter(project => project.status === 'PENDING').length

      list.push(
        {
          key: 'projects',
          label: 'Projects',
          value: projectsState.value.error ? null : count(projects.value.length),
          icon: 'mdi-apps',
          tone: 'primary',
          hint: waiting ? `${waiting} waiting for activation` : 'None waiting for activation',
          loading: projectsState.value.loading,
          to: '/projects',
        },
        {
          key: 'active',
          label: 'Active projects',
          value: projectsState.value.error ? null : projects.value.filter(project => project.status === 'ACTIVE').length,
          icon: 'mdi-check-circle-outline',
          tone: 'success',
          loading: projectsState.value.loading,
        },
      )
    }

    if (canUsers.value) {
      const users = catalog.users

      list.push({
        key: 'users',
        label: 'Users',
        value: stateOf('users').error ? null : count(users.length),
        icon: 'mdi-account-multiple-outline',
        tone: 'info',
        hint: `${users.filter(user => user.authId).length} already signed in once`,
        loading: stateOf('users').loading,
        to: '/users',
      })
    }

    if (canRoutes.value) {
      list.push({
        key: 'routes',
        label: 'Routes',
        value: stateOf('routes').error ? null : count(catalog.routes.length),
        icon: 'mdi-sitemap-outline',
        tone: 'neutral',
        // Sem link: rota nao tem tela propria. Ela mora dentro de cada projeto, em arvore.
        hint: 'Managed inside each project',
        loading: stateOf('routes').loading,
      })
    }

    return list
  })

  /* ---------------------------- por situacao ---------------------------- */

  const STATUS_TONE = { ACTIVE: 'success', PENDING: 'warning', SUSPENDED: 'error' } as const

  const statusCounts = computed(() =>
    (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map(status => ({
      status,
      label: PROJECT_STATUS[status].label,
      value: projects.value.filter(project => project.status === status).length,
      // A mesma cor da pastilha de situacao: o grafico e a tabela contam a mesma historia.
      color: toneColor(STATUS_TONE[status], theme.value),
    })),
  )

  function share (value: number): string {
    return projects.value.length > 0 ? `${((value / projects.value.length) * 100).toFixed(0)}%` : '0%'
  }

  const statusSlices = computed(() => statusCounts.value.filter(item => item.value > 0))

  const statusSeries = computed(() =>
    statusSlices.value.map(item => ({ label: item.label, color: item.color, value: `${item.value} · ${share(item.value)}` })),
  )

  const statusRows = computed(() => statusCounts.value.map(item => [item.label, String(item.value), share(item.value)]))

  /* ----------------------------- membros ----------------------------- */

  const memberColor = computed(() => seriesColor(0, preferences.isDark))

  const memberBars = computed(() =>
    projects.value
      .map(project => ({ label: project.name, value: project.projectUsers?.length ?? 0, color: memberColor.value }))
      .filter(item => item.value > 0)
      .toSorted((a, b) => b.value - a.value)
      .slice(0, 8),
  )

  const memberSeries = computed(() => [{ label: 'Members', color: memberColor.value }])

  const memberRows = computed(() => memberBars.value.map(item => [item.label, String(item.value)]))

  /* ---------------------------- crescimento ---------------------------- */

  const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

  const months = computed(() => {
    const now = new Date()

    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)

      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: MONTH.format(date), long: MONTH_YEAR.format(date) }
    })
  })

  const growthValues = computed(() =>
    months.value.map(month =>
      projects.value.filter(project => {
        const created = new Date(project.createdAt)

        return `${created.getFullYear()}-${created.getMonth()}` === month.key
      }).length,
    ),
  )

  const growthSeries = computed(() => [
    { label: 'Projects', color: seriesColor(0, preferences.isDark), values: growthValues.value },
  ])

  const growthRows = computed(() => months.value.map((month, index) => [month.long, String(growthValues.value[index] ?? 0)]))

  /* ----------------------------- pendentes ----------------------------- */

  interface PendingRow extends Record<string, unknown> {
    id: string
    name: string
    status: ProjectStatus
    createdAt: string
  }

  const pending = computed<PendingRow[]>(() =>
    projects.value
      .filter(project => project.status === 'PENDING')
      .map(project => ({ id: project.id, name: project.name, status: project.status, createdAt: project.createdAt })),
  )

  const pendingColumns = computed<Column<PendingRow>[]>(() =>
    inferColumns(pending.value, {
      omit: ['id'],
      overrides: {
        name: { label: 'Project' },
        status: { label: 'Status', width: '150px' },
        createdAt: { label: 'Registered', width: '170px' },
      },
    }),
  )

  onMounted(async () => {
    const kinds: CatalogKind[] = [
      ...(canProjects.value ? ['projects' as const] : []),
      ...(canUsers.value ? ['users' as const] : []),
      ...(canRoutes.value ? ['routes' as const] : []),
    ]

    const results = await Promise.allSettled(kinds.map(kind => catalog.ensure(kind)))
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')

    if (failure) {
      toast.error('Part of the overview could not be loaded', { description: errorMessage(failure.reason) })
    }
  })
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(v-bind(STAT_CARD_MIN_WIDTH), 1fr));
  gap: 16px;
}

.charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.charts__wide {
  grid-column: 1 / -1;
}

.chart-placeholder {
  display: grid;
  place-items: center;
  padding: 12px 0;
}
</style>
