<template>
  <DlSectionCard
    :description="description"
    title="Ready to use the SSO"
  >
    <template v-if="overview.status !== 'ACTIVE' && canActivate" #actions>
      <DlButton
        :disabled="!ready"
        icon="mdi-play-circle-outline"
        :loading="activating"
        @click="emit('activate')"
      >
        Activate project
      </DlButton>
    </template>

    <ul class="checklist">
      <li v-for="item in items" :key="item.key" class="checklist__item" :class="{ 'checklist__item--done': item.done }">
        <VIcon
          class="checklist__icon"
          :icon="item.done ? 'mdi-check-circle' : 'mdi-circle-outline'"
          size="20"
        />

        <div class="checklist__text">
          <span class="checklist__label">{{ item.label }}</span>
          <span class="checklist__detail">{{ item.detail }}</span>
        </div>

        <span v-if="item.required" class="checklist__required">Required</span>
      </li>
    </ul>
  </DlSectionCard>
</template>

<script lang="ts" setup>
  import type { ProjectOverview } from '@/types/sso'
  import { DlButton, DlSectionCard } from '@pedrolucaslopes/dotlog-ui'
  import { computed } from 'vue'
  import { keyState, plural } from '@/utils/format'

  /**
   * O que falta para o projeto funcionar, em ordem.
   *
   * O backend so recusa ativar sem chave de cliente. Sem redirect URI, porem, o
   * authorize recusa todo pedido, e ativar produziria um projeto "ativo" que nao
   * autentica ninguem. Por isso as duas sao exigidas aqui antes do botao liberar:
   * e bloqueio por estado, temporario, que e o caso de desabilitar e nao esconder.
   */
  const props = defineProps<{
    overview: ProjectOverview
    canActivate: boolean
    activating: boolean
  }>()

  const emit = defineEmits<{ activate: [] }>()

  const activeKeys = computed(() => props.overview.clientKeys.filter(key => keyState(key) === 'ACTIVE').length)
  const grantedRoles = computed(() => props.overview.roles.filter(role => role.permissions.length > 0).length)

  const items = computed(() => [
    {
      key: 'redirect',
      label: 'Redirect URI registered',
      detail: props.overview.redirectUriRecords.length > 0
        ? plural(props.overview.redirectUriRecords.length, 'address', 'addresses')
        : 'The SSO only returns a sign-in to a registered address.',
      done: props.overview.redirectUriRecords.length > 0,
      required: true,
    },
    {
      key: 'key',
      label: 'Active client key',
      detail: activeKeys.value
        ? plural(activeKeys.value, 'active key')
        : 'The application proves who it is by signing with the private half.',
      done: activeKeys.value > 0,
      required: true,
    },
    {
      key: 'routes',
      label: 'Routes registered',
      detail: props.overview.routes.length > 0
        ? plural(props.overview.routes.length, 'route')
        : 'A route that is not in the catalogue answers 403 to everyone.',
      done: props.overview.routes.length > 0,
      required: false,
    },
    {
      key: 'grants',
      label: 'Routes granted to a role',
      detail: grantedRoles.value
        ? `${plural(grantedRoles.value, 'role')} with permissions`
        : 'Permissions connect a role to the routes it unlocks.',
      done: grantedRoles.value > 0,
      required: false,
    },
    {
      key: 'members',
      label: 'People with access',
      detail: props.overview.users.length > 0
        ? plural(props.overview.users.length, 'member')
        : 'Only members can sign in to this application.',
      done: props.overview.users.length > 0,
      required: false,
    },
  ])

  const ready = computed(() => items.value.filter(item => item.required).every(item => item.done))

  const description = computed(() => {
    if (props.overview.status === 'ACTIVE') {
      return 'This project is active. Applications with its client ID can sign people in.'
    }

    return ready.value
      ? 'Everything required is in place. Activating lets the application start signing people in.'
      : 'A project only uses the SSO after activation, and activation needs the required items below.'
  })
</script>

<style scoped>
.checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.checklist__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--dl-outline);
}

.checklist__item:last-child {
  border-bottom: none;
}

.checklist__icon {
  color: var(--dl-on-surface-muted);
  flex-shrink: 0;
  transition: color var(--dl-motion-normal, 200ms) var(--dl-easing);
}

.checklist__item--done .checklist__icon {
  color: rgb(var(--v-theme-success));
}

.checklist__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}

.checklist__label {
  font-size: 14px;
  font-weight: 500;
  color: var(--dl-on-surface);
}

.checklist__detail {
  font-size: 13px;
  color: var(--dl-on-surface-muted);
}

.checklist__required {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dl-on-surface-muted);
}

@media (prefers-reduced-motion: reduce) {
  .checklist__icon {
    transition: none;
  }
}
</style>
