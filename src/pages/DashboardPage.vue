<template>
  <div class="page">
    <DlPageHeader
      :description="t('dashboard.description')"
      :title="greeting"
      :with-menu="false"
    />

    <section v-if="stats.length > 0" :aria-label="t('dashboard.totals')" class="stats">
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
      :description="t('dashboard.nothingDescription')"
      icon="mdi-eye-off-outline"
      :title="t('dashboard.nothingTitle')"
    />

    <section v-if="canProjects" :aria-label="t('dashboard.charts')" class="charts">
      <DlChartFrame
        :description="t('counts.projects', projects.length)"
        :empty="projectsState.ready && (projects.length === 0 || !!projectsState.error)"
        :empty-message="projectsState.error ?? t('dashboard.byStatus.empty')"
        :loading="projectsState.loading"
        :series="statusSeries"
        :table-headers="[t('common.status'), t('common.projects'), t('dashboard.byStatus.share')]"
        :table-rows="statusRows"
        :title="t('dashboard.byStatus.title')"
      >
        <DlDonutChart :data="statusSlices" :total-label="t('common.projects')" />

        <template #loading>
          <div class="chart-placeholder">
            <DlSkeleton variant="circle" width="160px" />
          </div>
        </template>
      </DlChartFrame>

      <DlChartFrame
        :description="t('dashboard.members.description')"
        :empty="projectsState.ready && memberBars.length === 0"
        :empty-message="projectsState.error ?? t('dashboard.members.empty')"
        :loading="projectsState.loading"
        :series="memberSeries"
        :table-headers="[t('common.project'), t('common.members')]"
        :table-rows="memberRows"
        :title="t('dashboard.members.title')"
      >
        <DlBarChart :data="memberBars" />

        <template #loading>
          <DlSkeleton height="22px" :lines="5" />
        </template>
      </DlChartFrame>

      <DlChartFrame
        class="charts__wide"
        :description="t('dashboard.growth.description')"
        :empty="projectsState.ready && (projects.length === 0 || !!projectsState.error)"
        :empty-message="projectsState.error ?? t('dashboard.byStatus.empty')"
        :loading="projectsState.loading"
        :series="growthSeries"
        :table-headers="[t('dashboard.growth.month'), t('dashboard.growth.title')]"
        :table-rows="growthRows"
        :title="t('dashboard.growth.title')"
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
      :description="t('dashboard.pending.description')"
      :padded="!projectsState.ready || pending.length === 0"
      :title="t('dashboard.pending.title')"
    >
      <DlSkeleton v-if="projectsState.loading" height="36px" :lines="3" />

      <DlEmptyState
        v-else-if="pending.length === 0"
        compact
        :description="t('dashboard.pending.emptyDescription')"
        icon="mdi-check-all"
        :title="t('dashboard.pending.emptyTitle')"
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
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { LOOKUP_LIMIT, STAT_CARD_MIN_WIDTH } from '@/constants/layout'
  import { PROJECT_STATUS } from '@/constants/status'
  import { toneColor } from '@/constants/theme'
  import { errorMessage } from '@/services/http'
  import { type CatalogKind, useCatalogStore } from '@/stores/catalog'
  import { usePreferencesStore } from '@/stores/preferences'
  import { useSessionStore } from '@/stores/session'
  import { firstName } from '@/utils/format'

  /**
   * Painel de entrada. Cada indicador e grafico so aparece para quem pode ler
   * o recurso de onde ele sai; um cartao com "—" para quem nao pode ver usuarios
   * so apontaria o que a pessoa nao alcanca.
   */
  const { t, locale } = useI18n()
  const router = useRouter()
  const session = useSessionStore()
  const catalog = useCatalogStore()
  const preferences = usePreferencesStore()

  const canProjects = computed(() => session.can('GET', '/project'))
  const canUsers = computed(() => session.can('GET', '/user'))
  const canRoutes = computed(() => session.can('GET', '/route'))

  const greeting = computed(() => (session.me ? t('dashboard.welcome', { name: firstName(session.me.name) }) : t('nav.overview')))

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
          label: t('dashboard.stats.projects'),
          value: projectsState.value.error ? null : count(projects.value.length),
          icon: 'mdi-apps',
          tone: 'primary',
          hint: waiting ? t('dashboard.stats.waiting', { count: waiting }) : t('dashboard.stats.noneWaiting'),
          loading: projectsState.value.loading,
          to: '/projects',
        },
        {
          key: 'active',
          label: t('dashboard.stats.activeProjects'),
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
        label: t('dashboard.stats.users'),
        value: stateOf('users').error ? null : count(users.length),
        icon: 'mdi-account-multiple-outline',
        tone: 'info',
        hint: t('dashboard.stats.signedIn', { count: users.filter(user => user.authId).length }),
        loading: stateOf('users').loading,
        to: '/users',
      })
    }

    if (canRoutes.value) {
      list.push({
        key: 'routes',
        label: t('dashboard.stats.routes'),
        value: stateOf('routes').error ? null : count(catalog.routes.length),
        icon: 'mdi-sitemap-outline',
        tone: 'neutral',
        // Sem link: rota nao tem tela propria. Ela mora dentro de cada projeto, em arvore.
        hint: t('dashboard.stats.routesHint'),
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

  const memberSeries = computed(() => [{ label: t('common.members'), color: memberColor.value }])

  const memberRows = computed(() => memberBars.value.map(item => [item.label, String(item.value)]))

  /* ---------------------------- crescimento ---------------------------- */

  const months = computed(() => {
    const now = new Date()
    // Na lingua da tela: o eixo e a tabela trocam de mes junto com o resto.
    const MONTH = new Intl.DateTimeFormat(locale.value, { month: 'short' })
    const MONTH_YEAR = new Intl.DateTimeFormat(locale.value, { month: 'short', year: 'numeric' })

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
    { label: t('common.projects'), color: seriesColor(0, preferences.isDark), values: growthValues.value },
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
      locale: locale.value,
      overrides: {
        name: { label: t('common.project') },
        status: { label: t('common.status'), width: '150px' },
        createdAt: { label: t('common.registered'), width: '170px' },
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
      toast.error(t('dashboard.loadFailed'), { description: errorMessage(failure.reason) })
    }
  })
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/*
 * Flex, e nao grid. Com `repeat(auto-fit, minmax(...))` a ultima linha mantem a
 * largura das colunas e o que sobra vira buraco: o cartao que fica sozinho na
 * segunda linha deixava o resto dela vazio. No flex, ele cresce e ocupa a
 * largura inteira.
 */
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.stats > * {
  flex: 1 1 v-bind(STAT_CARD_MIN_WIDTH);
  min-width: 0;
}

.charts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.charts > * {
  /* `min-width: 0` para o grafico poder encolher: sem isso o conteudo define o
     piso e a linha estoura para a direita. */
  flex: 1 1 320px;
  min-width: 0;
}

.charts__wide {
  flex-basis: 100%;
}

.chart-placeholder {
  display: grid;
  place-items: center;
  padding: 12px 0;
}
</style>
