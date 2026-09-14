/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

import type { App } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import { configureHttp } from '@/services/http'
import { useSessionStore } from '@/stores/session'
import vuetify from './vuetify'

export function registerPlugins (app: App) {
  const pinia = createPinia()

  app.use(vuetify)
  app.use(pinia)

  // A camada HTTP nao importa store: ela recebe de onde ler o token anti-CSRF e
  // o que fazer quando a sessao cai. Assim o servico continua testavel sozinho.
  const session = useSessionStore(pinia)

  configureHttp({
    csrfToken: () => session.csrfToken,
    unauthorized: () => session.handleUnauthorized(),
  })

  app.use(router)
}
