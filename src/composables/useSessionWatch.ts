import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SESSION_RECHECK_MS } from '@/constants/api'
import { useSessionStore } from '@/stores/session'

/** Duas conferencias seguidas, como foco e visibilidade juntos, viram uma so. */
const MIN_GAP_MS = 5000

/**
 * Mantem o console em dia com o que mudou no SSO enquanto a pessoa o usa.
 *
 * O SSO rele o papel a cada chamada, entao a API ja respeitava uma troca feita
 * por outra pessoa. A tela nao: `GET /sso/me` era lido uma vez, na carga da
 * pagina, e menu e acoes so acompanhavam depois de recarregar.
 *
 * Rele a sessao a cada `SESSION_RECHECK_MS` com a aba visivel, e na hora em que
 * a pessoa volta para ela:
 *
 * - **papel diferente:** menu, cabecalho e acoes acompanham sozinhos. Se a tela
 *   aberta deixou de ser alcancada, vai para a de "nao permitido";
 * - **tirada do projeto SSO:** a sessao continua, o console nao, e ela vai para a
 *   tela de sem acesso, com "usar outra conta";
 * - **sessao encerrada:** vai ao login.
 */
export function useSessionWatch (): void {
  const session = useSessionStore()
  const route = useRoute()
  const router = useRouter()

  let timer: ReturnType<typeof setInterval> | undefined
  let lastCheck = 0

  async function check (): Promise<void> {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < MIN_GAP_MS) {
      return
    }

    lastCheck = Date.now()

    const result = await session.revalidate()

    if (result === 'ended') {
      session.beginLogin(route.fullPath)

      return
    }

    if (result === 'no-access') {
      await router.replace({ name: 'no-access' })

      return
    }

    const permission = route.meta.permission

    if (result === 'changed' && permission && !session.can(permission.method, permission.path)) {
      await router.replace({ name: 'forbidden', query: { from: route.fullPath } })
    }
  }

  function onReturn (): void {
    void check()
  }

  onMounted(() => {
    lastCheck = Date.now()
    timer = setInterval(onReturn, SESSION_RECHECK_MS)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onReturn)
    window.removeEventListener('focus', onReturn)
  })
}
