<template>
  <div class="page">
    <DlPageHeader
      :breadcrumbs="[{ label: t('nav.credentials') }, { label: t('clientKeys.title') }]"
      :description="t('clientKeys.pageDescription')"
      :title="t('clientKeys.title')"
      :with-menu="false"
    />

    <div class="toolbar">
      <DlSelect
        :label="t('common.project')"
        :loading="catalog.state.projects.loading"
        :model-value="selectedId"
        :options="projectOptions"
        :placeholder="t('clientKeys.choosePlaceholder')"
        @update:model-value="select"
      />
    </div>

    <ClientKeysPanel v-if="selected" :project-id="selected.id" :project-name="selected.name" />

    <DlEmptyState
      v-else
      :description="t('clientKeys.noProjectDescription')"
      icon="mdi-key-variant"
      :title="t('clientKeys.noProjectTitle')"
    />
  </div>
</template>

<script lang="ts" setup>
  import { DlEmptyState, DlPageHeader, DlSelect, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import ClientKeysPanel from '@/components/ClientKeysPanel.vue'
  import { errorMessage } from '@/services/http'
  import { useCatalogStore } from '@/stores/catalog'
  import { queryString } from '@/utils/format'
  import { asOption } from '@/utils/forms'

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const catalog = useCatalogStore()

  const selectedId = computed(() => queryString(route.query.project))

  const selected = computed(() => catalog.projects.find(project => project.id === selectedId.value) ?? null)

  const projectOptions = computed(() => catalog.projects.map(project => ({ title: project.name, value: project.id })))

  function select (value: unknown): void {
    const projectId = asOption(value)

    void router.replace({ query: projectId ? { project: projectId } : {} })
  }

  onMounted(() => {
    catalog.ensure('projects').catch(error => {
      toast.error(t('common.projectsLoadFailed'), { description: errorMessage(error) })
    })
  })
</script>
