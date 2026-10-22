import { onBeforeUnmount, ref } from 'vue'
import { TURNSTILE_SCRIPT_URL } from '@/constants/api'

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

function loadTurnstile (): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }

  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')

    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.addEventListener('load', () => {
      if (window.turnstile) {
        resolve(window.turnstile)
      } else {
        loading = null
        reject(new Error('turnstile_unavailable'))
      }
    })
    script.addEventListener('error', () => {
      loading = null
      reject(new Error('turnstile_unavailable'))
    })

    document.head.append(script)
  })

  return loading
}

export function useHumanCheck () {
  const token = ref<string | null>(null)
  const failed = ref(false)

  let widgetId: string | null = null

  function unmount (): void {
    if (widgetId && window.turnstile) {
      window.turnstile.remove(widgetId)
    }

    widgetId = null
    token.value = null
  }

  async function mount (element: HTMLElement, siteKey: string, action: string): Promise<void> {
    unmount()
    failed.value = false

    try {
      const turnstile = await loadTurnstile()

      widgetId = turnstile.render(element, {
        'sitekey': siteKey,
        action,
        'theme': 'auto',
        'callback': (value: string) => {
          token.value = value
        },
        'expired-callback': () => {
          token.value = null
        },
        'error-callback': () => {
          token.value = null
          failed.value = true
        },
      })
    } catch {
      failed.value = true
    }
  }

  function reset (): void {
    token.value = null

    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId)
    }
  }

  onBeforeUnmount(unmount)

  return { token, failed, mount, reset, unmount }
}
