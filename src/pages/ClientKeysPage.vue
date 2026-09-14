<template>
  <div class="page">
    <DlPageHeader
      :breadcrumbs="[{ label: 'Credentials' }, { label: 'Client keys' }]"
      description="Keys that applications sign with to prove who they are to the SSO. Every key belongs to one project."
      title="Client keys"
      :with-menu="false"
    />

    <div class="toolbar">
      <DlSelect
        label="Project"
        :loading="catalog.state.projects.loading"
        :model-value="selectedId"
        :options="projectOptions"
        placeholder="Choose a project"
        @update:model-value="select"
      />
    </div>

    <ClientKeysPanel v-if="selected" :project-id="selected.id" :project-name="selected.name" />

    <DlEmptyState
      v-else
      description="Choose a project above to see and manage its keys."
      icon="mdi-key-variant"
      title="No project selected"
    />
  </div>
</template>

<script lang="ts" setup>
  import { DlEmptyState, DlPageHeader, DlSelect, toast } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import ClientKeysPanel from '@/components/ClientKeysPanel.vue'
  import { errorMessage } from '@/services/http'
  import { useCatalogStore } from '@/stores/catalog'
  import { queryString } from '@/utils/format'
  import { asOption } from '@/utils/forms'

  /** O projeto escolhido fica na URL: o link leva direto as chaves dele. */
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
      toast.error('Projects could not be loaded', { description: errorMessage(error) })
    })
  })
</script>
