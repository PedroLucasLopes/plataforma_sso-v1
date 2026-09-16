<template>
  <DlSectionCard
    :description="description"
    :title="t('checklist.title')"
  >
    <template v-if="overview.status !== 'ACTIVE' && canActivate" #actions>
      <DlButton
        :disabled="!ready"
        icon="mdi-play-circle-outline"
        :loading="activating"
        @click="emit('activate')"
      >
        {{ t('project.activateProject') }}
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

        <span v-if="item.required" class="checklist__required">{{ t('checklist.required') }}</span>
      </li>
    </ul>
  </DlSectionCard>
</template>

<script lang="ts" setup>
  import type { ProjectOverview } from '@/types/sso'
  import { DlButton, DlSectionCard } from '@pedrolucaslopes/dotlog-ui'
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { keyState } from '@/utils/format'

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

  const { t } = useI18n()

  const activeKeys = computed(() => props.overview.clientKeys.filter(key => keyState(key) === 'ACTIVE').length)
  const grantedRoles = computed(() => props.overview.roles.filter(role => role.permissions.length > 0).length)

  const items = computed(() => [
    {
      key: 'redirect',
      label: t('checklist.redirect.label'),
      detail: props.overview.redirectUriRecords.length > 0
        ? t('counts.addresses', props.overview.redirectUriRecords.length)
        : t('checklist.redirect.empty'),
      done: props.overview.redirectUriRecords.length > 0,
      required: true,
    },
    {
      key: 'key',
      label: t('checklist.key.label'),
      detail: activeKeys.value
        ? t('counts.activeKeys', activeKeys.value)
        : t('checklist.key.empty'),
      done: activeKeys.value > 0,
      required: true,
    },
    {
      key: 'routes',
      label: t('checklist.routes.label'),
      detail: props.overview.routes.length > 0
        ? t('counts.routes', props.overview.routes.length)
        : t('checklist.routes.empty'),
      done: props.overview.routes.length > 0,
      required: false,
    },
    {
      key: 'grants',
      label: t('checklist.grants.label'),
      detail: grantedRoles.value
        ? t('checklist.grants.done', grantedRoles.value)
        : t('checklist.grants.empty'),
      done: grantedRoles.value > 0,
      required: false,
    },
    {
      key: 'members',
      label: t('checklist.members.label'),
      detail: props.overview.users.length > 0
        ? t('counts.members', props.overview.users.length)
        : t('checklist.members.empty'),
      done: props.overview.users.length > 0,
      required: false,
    },
  ])

  const ready = computed(() => items.value.filter(item => item.required).every(item => item.done))

  const description = computed(() => {
    if (props.overview.status === 'ACTIVE') {
      return t('checklist.active')
    }

    return ready.value
      ? t('checklist.ready')
      : t('checklist.notReady')
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
