<template>
  <DlSectionCard
    :count="project.roles.length"
    :description="t('roles.description')"
    :padded="project.roles.length === 0"
    :title="t('roles.title')"
  >
    <template v-if="canCreate" #actions>
      <DlButton icon="mdi-plus" variant="tonal" @click="dialog.openCreate()">{{ t('roles.add') }}</DlButton>
    </template>

    <DlEmptyState
      v-if="project.roles.length === 0"
      compact
      :description="t('roles.emptyDescription')"
      icon="mdi-shield-account-outline"
      :title="t('roles.emptyTitle')"
    />

    <DlExpansion
      v-else
      v-model:open="openPanels"
      multiple
      :panels="panels"
    >
      <template v-for="role in roles" :key="role.id" #[role.id]>
        <p v-if="isRootRole(role)" class="roles__hint roles__lead">
          {{ t('roles.rootLead') }}
        </p>

        <p v-if="project.routes.length === 0" class="roles__hint">
          {{ t('roles.noRoutes') }}
        </p>

        <template v-else>
          <div v-if="canManage && getRouteCount > 0 && !isRootRole(role)" class="roles__bulk">
            <span class="roles__hint">{{ bulkHint(role) }}</span>

            <DlButton
              :disabled="missingGet(role.id) === 0"
              icon="mdi-eye-check-outline"
              :loading="isBulkBusy(role.id)"
              size="small"
              variant="outlined"
              @click="grantEveryGet(role)"
            >
              {{ t('roles.grantAllGet') }}
            </DlButton>
          </div>

          <DlRouteTree
            class="roles__tree"
            hide-methods
            :label="t('roles.treeLabel', { role: roleLabel(role.name) })"
            :routes="project.routes"
            :selectable="false"
          >
            <template #node-end="{ node }">
              <template v-for="item in node.routes" :key="item.id">
                <VCheckbox
                  v-if="canManage"
                  :aria-label="t('grants.canCall', { role: roleLabel(role.name), method: item.method, path: item.path })"
                  color="primary"
                  density="compact"
                  :disabled="isBusy(role.id, item.id)"
                  hide-details
                  :model-value="!!permissionOf(role.id, item.id)"
                  @update:model-value="checked => toggle(role.id, item.id, !!checked)"
                >
                  <template #label>
                    <DlStatusChip :map="METHOD_STATUS" :status="item.method" :with-icon="false" />
                  </template>
                </VCheckbox>

                <span v-else-if="permissionOf(role.id, item.id)" class="roles__granted">
                  <VIcon aria-hidden="true" color="success" icon="mdi-check" size="16" />
                  <DlStatusChip :map="METHOD_STATUS" :status="item.method" :with-icon="false" />
                </span>
              </template>

              <VBtn
                :aria-label="t('roles.openInRoutes', { path: node.key })"
                density="comfortable"
                icon="mdi-arrow-top-right"
                size="small"
                :title="t('roles.openInRoutes', { path: node.key })"
                variant="text"
                @click="openRoute(node.key)"
              />
            </template>
          </DlRouteTree>
        </template>

        <div v-if="canRename(role) || canDelete(role)" class="roles__footer">
          <span v-if="canDelete(role) && !removable(role)" class="roles__hint">
            {{ t('roles.deleteBlocked') }}
          </span>

          <DlButton
            v-if="canRename(role)"
            icon="mdi-pencil-outline"
            size="small"
            variant="text"
            @click="renameDialog.openEdit(role.id, { name: role.name })"
          >
            {{ t('roles.rename') }}
          </DlButton>

          <DlButton
            v-if="canDelete(role)"
            color="error"
            :disabled="!removable(role)"
            icon="mdi-delete-outline"
            size="small"
            variant="text"
            @click="removal.ask(role)"
          >
            {{ t('roles.delete') }}
          </DlButton>
        </div>
      </template>
    </DlExpansion>

    <template v-if="catalogLocked" #footer>
      {{ t('roles.selfNote') }}
    </template>
  </DlSectionCard>

  <DlFormDialog
    v-model="dialog.open"
    :description="t('roles.addDescription', { project: project.name })"
    :dirty="dialog.dirty"
    :error="dialog.error"
    mode="create"
    :submitting="dialog.submitting"
    :title="t('roles.add')"
    @submit="save"
  >
    <DlTextField
      :error="nameError"
      :hint="nameHint(dialog.form.name)"
      :label="t('common.name')"
      :model-value="dialog.form.name"
      mono
      :placeholder="t('roles.namePlaceholder')"
      required
      @update:model-value="value => (dialog.form.name = asRoleName(value))"
    />
  </DlFormDialog>

  <DlFormDialog
    v-model="renameDialog.open"
    :description="t('roles.renameDescription')"
    :dirty="renameDialog.dirty"
    :error="renameDialog.error"
    mode="edit"
    :submitting="renameDialog.submitting"
    :title="t('roles.rename')"
    @submit="saveRename"
  >
    <DlTextField
      :error="renameError"
      :hint="nameHint(renameDialog.form.name)"
      :label="t('common.name')"
      :model-value="renameDialog.form.name"
      mono
      required
      @update:model-value="value => (renameDialog.form.name = asRoleName(value))"
    />
  </DlFormDialog>

  <DlConfirmDialog
    v-model="removal.open"
    :confirm-label="t('roles.delete')"
    destructive
    :error="removal.error"
    :message="removal.target ? t('roles.deleteMessage', { role: roleLabel(removal.target.name), project: project.name }) : ''"
    :processing="removal.processing"
    :title="t('roles.delete')"
    @confirm="remove"
  />
</template>

<script lang="ts" setup>
  import type { ProjectOverview } from '@/types/sso'
  import {
    DlButton,
    DlConfirmDialog,
    DlEmptyState,
    DlExpansion,
    DlFormDialog,
    DlRouteTree,
    DlSectionCard,
    DlStatusChip,
    DlTextField,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { useGrants } from '@/composables/useGrants'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { METHOD_STATUS, ROOT_ROLE_NAME } from '@/constants/status'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { asRoleName, ROLE_NAME_PATTERN, roleNameError } from '@/utils/forms'
  import { customRoleLabel, isDefaultRole, type ProjectRole, roleDefinition, roleLabel, sortRoles } from '@/utils/routes'

  /**
   * Papeis do projeto e as rotas que cada um libera, na mesma arvore da aba de
   * rotas. Com trezentas rotas, uma lista plana por papel viraria rolagem sem
   * fim; em arvore, cada ramo fecha.
   *
   * A linha so abre e fecha. Marcar fica na caixa, e ver o detalhe do caminho
   * fica no botao ao lado: um clique distraido na linha nao tira a pessoa do
   * papel que ela estava editando.
   *
   * E o unico lugar do console onde papel se cria, renomeia e apaga: nao ha
   * tela global de papeis, que buscaria os de todos os projetos de uma vez.
   * Todo projeto nasce com SUPERADMIN, ADMIN, MANAGER e VIEWER, vazios. Os
   * outros papeis tem nome livre, como ARQUITETO, e tambem nascem vazios.
   */
  const props = defineProps<{ project: ProjectOverview }>()

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const projects = useProjectsStore()
  const { canManage, permissionOf, isBusy, toggle, missingOf, grantAll, isBulkBusy } = useGrants(() => props.project)

  const isSelf = computed(() => props.project.name === SELF_PROJECT_NAME)

  /** O catalogo do proprio SSO so a raiz muda. O servidor recusa os outros; a tela nem oferece. */
  const catalogLocked = computed(() => isSelf.value && !session.root)

  const canCreate = computed(() => !catalogLocked.value && session.can('POST', '/role'))

  const roles = computed(() => sortRoles(props.project.roles))

  const openPanels = ref<string[]>([])

  /** O SUPERADMIN do SSO e a raiz: nao se renomeia nem se apaga, nem por ela. */
  const isRootRole = (role: ProjectRole): boolean => isSelf.value && role.name === ROOT_ROLE_NAME

  const membersOf = (roleName: string): number => props.project.users.filter(user => user.role === roleName).length

  function removable (role: ProjectRole): boolean {
    return role.permissions.length === 0 && membersOf(role.name) === 0
  }

  function canRename (role: ProjectRole): boolean {
    return !catalogLocked.value && !isRootRole(role) && session.can('PUT', `/role/${role.id}`)
  }

  function canDelete (role: ProjectRole): boolean {
    return !catalogLocked.value && !isRootRole(role) && session.can('DELETE', `/role/${role.id}`)
  }

  const panels = computed(() =>
    roles.value.map(role => ({
      key: role.id,
      title: roleLabel(role.name),
      summary: isRootRole(role)
        ? t('roles.summaryRoot', { members: t('counts.members', membersOf(role.name)) })
        : [
          // O icone sozinho nao diz o que marca: o resumo diz, por escrito.
          ...(isDefaultRole(role.name) ? [] : [t('roles.custom')]),
          t('roles.summary', {
            granted: role.permissions.length,
            routes: t('counts.routes', props.project.routes.length),
            members: t('counts.members', membersOf(role.name)),
          }),
        ].join(' · '),
      icon: roleDefinition(role.name).icon,
    })),
  )

  /* ---------------------------- atalho de leitura ---------------------------- */

  const getRouteCount = computed(() => props.project.routes.filter(item => item.method === 'GET').length)

  const missingGet = (roleId: string): number => missingOf(roleId, 'GET').length

  function bulkHint (role: ProjectRole): string {
    const missing = missingGet(role.id)

    return missing === 0
      ? t('roles.allGetGranted', { role: roleLabel(role.name) })
      : t('roles.getMissing', { role: roleLabel(role.name) }, missing)
  }

  async function grantEveryGet (role: ProjectRole): Promise<void> {
    const granted = await grantAll(role.id, 'GET')

    if (granted > 0) {
      toast.success(t('roles.getGranted', granted), { description: t('roles.inProject', { role: roleLabel(role.name), project: props.project.name }) })
    }
  }

  /** Detalhe do caminho, na aba de rotas. Entra no historico: voltar retorna a este papel. */
  function openRoute (key: string): void {
    void router.push({ query: { ...route.query, tab: 'routes', route: key } })
  }

  /* --------------------------------- gravacao -------------------------------- */

  const dialog = useCrudDialog(() => ({ name: '' }))
  const renameDialog = useCrudDialog(() => ({ name: '' }))

  /** Enquanto digita, a regra do nome; com o nome valido, como ele vai aparecer. */
  function nameHint (name: string): string {
    return ROLE_NAME_PATTERN.test(name)
      ? t('roles.displayedAs', { label: customRoleLabel(name) })
      : t('common.roleNameHint')
  }
  const removal = useConfirm<ProjectRole>()

  const takenNames = computed(() => props.project.roles.map(role => role.name))

  const nameError = computed(() => (dialog.attempted ? roleNameError(dialog.form.name, takenNames.value) : null))

  const renaming = computed(() => props.project.roles.find(role => role.id === renameDialog.targetId) ?? null)

  const renameTaken = computed(() => takenNames.value.filter(name => name !== renaming.value?.name))

  const renameError = computed(() => (renameDialog.attempted ? roleNameError(renameDialog.form.name, renameTaken.value) : null))

  async function save (): Promise<void> {
    const name = dialog.form.name

    const ok = await dialog.submit(!roleNameError(name, takenNames.value), () => projects.addRole(props.project.id, name))

    if (ok) {
      toast.success(t('roles.added'), { description: t('roles.inProject', { role: name, project: props.project.name }) })
    }
  }

  async function saveRename (): Promise<void> {
    const roleId = renameDialog.targetId
    const previous = renaming.value?.name
    const name = renameDialog.form.name

    const ok = await renameDialog.submit(!!roleId && !roleNameError(name, renameTaken.value), async () => {
      if (roleId && name !== previous) {
        await projects.renameRole(props.project.id, roleId, name)
      }
    })

    if (ok && previous && name !== previous) {
      toast.success(t('roles.renamed'), { description: t('roles.renamedDescription', { previous, name, project: props.project.name }) })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(role => projects.removeRole(props.project.id, role.id))

    if (ok) {
      toast.success(t('roles.deleted'))
    }
  }
</script>

<style scoped>
/* A linha da arvore traz o proprio respiro lateral; o do painel ja basta. */
.roles__tree {
  margin: -6px -12px 0;
}

.roles__tree :deep(.v-checkbox) {
  flex: 0 0 auto;
}

.roles__granted {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.roles__hint {
  margin: 0;
  font-size: 13px;
  color: var(--dl-on-surface-muted);
}

.roles__lead {
  margin-bottom: 12px;
}

.roles__bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.roles__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
</style>
