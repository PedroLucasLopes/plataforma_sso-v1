<template>
  <DlSectionCard
    :count="project.roles.length"
    description="Each role unlocks the routes checked below, grouped by path. Changes apply on the next request, without anyone signing in again."
    :padded="project.roles.length === 0"
    title="Roles & permissions"
  >
    <template v-if="!catalogLocked && session.can('POST', '/role') && missingRoles.length > 0" #actions>
      <DlButton icon="mdi-plus" variant="tonal" @click="dialog.openCreate({ name: missingRoles[0] })">Add role</DlButton>
    </template>

    <DlEmptyState
      v-if="project.roles.length === 0"
      compact
      description="Create the roles this application uses, then check the routes each one unlocks."
      icon="mdi-shield-account-outline"
      title="No roles yet"
    />

    <DlExpansion
      v-else
      v-model:open="openPanels"
      multiple
      :panels="panels"
    >
      <template v-for="role in project.roles" :key="role.id" #[role.id]>
        <p v-if="project.routes.length === 0" class="roles__hint">
          Register routes first. A role only unlocks routes that exist in the catalogue.
        </p>

        <DlRouteTree
          v-else
          class="roles__tree"
          hide-methods
          :label="`Routes the ${roleLabel(role.name)} role unlocks`"
          :routes="project.routes"
          :selectable="false"
        >
          <template #node-end="{ node }">
            <template v-for="item in node.routes" :key="item.id">
              <VCheckbox
                v-if="canManage"
                :aria-label="`${roleLabel(role.name)} can call ${item.method} ${item.path}`"
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
              :aria-label="`Open ${node.key} in Routes`"
              density="comfortable"
              icon="mdi-arrow-top-right"
              size="small"
              :title="`Open ${node.key} in Routes`"
              variant="text"
              @click="openRoute(node.key)"
            />
          </template>
        </DlRouteTree>

        <div v-if="!catalogLocked && session.can('DELETE', `/role/${role.id}`)" class="roles__footer">
          <span v-if="!removable(role.id)" class="roles__hint">
            Uncheck every route and move the members to another role before deleting it.
          </span>

          <DlButton
            color="error"
            :disabled="!removable(role.id)"
            icon="mdi-delete-outline"
            size="small"
            variant="text"
            @click="removal.ask(role)"
          >
            Delete role
          </DlButton>
        </div>
      </template>
    </DlExpansion>

    <template v-if="catalogLocked" #footer>
      These are the SSO's own roles and permissions. They change only through scripts/bootstrap-sso.js, never here.
    </template>
  </DlSectionCard>

  <DlFormDialog
    v-model="dialog.open"
    description="A project has at most one role of each kind."
    :dirty="dialog.dirty"
    :error="dialog.error"
    mode="create"
    :submitting="dialog.submitting"
    title="Add role"
    @submit="save"
  >
    <DlSelect
      :clearable="false"
      label="Role"
      :model-value="dialog.form.name"
      :options="roleOptions"
      required
      @update:model-value="value => (dialog.form.name = (asOption(value) ?? '') as RoleName | '')"
    />
  </DlFormDialog>

  <DlConfirmDialog
    v-model="removal.open"
    confirm-label="Delete role"
    destructive
    :error="removal.error"
    :message="removal.target ? `The ${roleLabel(removal.target.name)} role leaves ${project.name}.` : ''"
    :processing="removal.processing"
    title="Delete role"
    @confirm="remove"
  />
</template>

<script lang="ts" setup>
  import type { ProjectOverview, RoleName } from '@/types/sso'
  import {
    DlButton,
    DlConfirmDialog,
    DlEmptyState,
    DlExpansion,
    DlFormDialog,
    DlRouteTree,
    DlSectionCard,
    DlSelect,
    DlStatusChip,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useConfirm } from '@/composables/useConfirm'
  import { useCrudDialog } from '@/composables/useCrudDialog'
  import { useGrants } from '@/composables/useGrants'
  import { SELF_PROJECT_NAME } from '@/constants/api'
  import { METHOD_STATUS, ROLE_NAMES, ROLE_STATUS } from '@/constants/status'
  import { useProjectsStore } from '@/stores/projects'
  import { useSessionStore } from '@/stores/session'
  import { plural } from '@/utils/format'
  import { asOption } from '@/utils/forms'
  import { type ProjectRole, roleLabel } from '@/utils/routes'

  /**
   * Papeis do projeto e as rotas que cada um libera, na mesma arvore da aba de
   * rotas. Com trezentas rotas, uma lista plana por papel viraria rolagem sem
   * fim; em arvore, cada ramo fecha.
   *
   * A linha so abre e fecha. Marcar fica na caixa, e ver o detalhe do caminho
   * fica no botao ao lado: um clique distraido na linha nao tira a pessoa do
   * papel que ela estava editando.
   */
  const props = defineProps<{ project: ProjectOverview }>()

  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const projects = useProjectsStore()
  const { canManage, permissionOf, isBusy, toggle } = useGrants(() => props.project)

  /** O catalogo do proprio SSO so muda pelo bootstrap. O servidor recusa; a tela nem oferece. */
  const catalogLocked = computed(() => props.project.name === SELF_PROJECT_NAME)

  const openPanels = ref<string[]>([])

  const membersOf = (roleName: RoleName): number => props.project.users.filter(user => user.role === roleName).length

  function removable (roleId: string): boolean {
    const role = props.project.roles.find(item => item.id === roleId)

    return !!role && role.permissions.length === 0 && membersOf(role.name) === 0
  }

  const panels = computed(() =>
    props.project.roles.map(role => ({
      key: role.id,
      title: roleLabel(role.name),
      summary: `${role.permissions.length} of ${plural(props.project.routes.length, 'route')} · ${plural(membersOf(role.name), 'member')}`,
      icon: ROLE_STATUS[role.name]?.icon,
    })),
  )

  const missingRoles = computed(() => ROLE_NAMES.filter(name => !props.project.roles.some(role => role.name === name)))

  const roleOptions = computed(() => missingRoles.value.map(name => ({ title: ROLE_STATUS[name].label, value: name })))

  /** Detalhe do caminho, na aba de rotas. Entra no historico: voltar retorna a este papel. */
  function openRoute (key: string): void {
    void router.push({ query: { ...route.query, tab: 'routes', route: key } })
  }

  const dialog = useCrudDialog(() => ({ name: '' as RoleName | '' }))
  const removal = useConfirm<ProjectRole>()

  async function save (): Promise<void> {
    const name = dialog.form.name

    const ok = await dialog.submit(!!name, async () => {
      if (name) {
        await projects.addRole(props.project.id, name)
      }
    })

    if (ok && name) {
      toast.success('Role added', { description: `${ROLE_STATUS[name].label} in ${props.project.name}` })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(role => projects.removeRole(props.project.id, role.id))

    if (ok) {
      toast.success('Role deleted')
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

.roles__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
</style>
