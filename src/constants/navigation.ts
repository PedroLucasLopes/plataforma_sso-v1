import {
  deriveNavGroups,
  type NavGroup,
  type NavOverride,
  type Permission,
} from '@pedrolucaslopes/dotlog-ui'
import { t } from '@/plugins/i18n'

/**
 * O menu sai das permissoes do papel, por `deriveNavGroups`: cada `GET` de um
 * segmento vira item. Daqui vem so o que o banco nao guarda: rotulo, icone,
 * grupo, ordem e a rota do front.
 *
 * `/permission`, `/projectuser` e `/redirecturi` nao tem `GET` e nao viram
 * item: sao geridos dentro da tela do projeto.
 *
 * `/route` e `/role` tem `GET` e mesmo assim ficam fora. Todas as rotas, ou
 * todos os papeis, de todas as aplicacoes numa lista so crescem sem limite e
 * nao ajudam ninguem a achar nada. Dentro do projeto, o proprio contexto diz a
 * que cada um pertence, e a tela so busca o que e daquele projeto.
 *
 * Os rotulos saem da traducao na hora de montar. Quem chama de dentro de um
 * `computed` ganha o menu trocado junto com a lingua.
 */
export function buildNavGroups (permissions: Permission[]): NavGroup[] {
  const overrides: Record<string, NavOverride> = {
    '/project': { label: t('nav.projects'), icon: 'mdi-apps', to: '/projects', group: 'catalogue', order: 1 },
    '/user': { label: t('nav.users'), icon: 'mdi-account-multiple-outline', to: '/users', group: 'catalogue', order: 2 },
    '/role': { hidden: true },
    '/route': { hidden: true },
    '/clientkey': { label: t('nav.clientKeys'), icon: 'mdi-key-variant', to: '/client-keys', group: 'credentials', order: 1 },
  }

  const groups = [
    { key: 'catalogue', title: t('nav.catalogue') },
    { key: 'credentials', title: t('nav.credentials') },
  ]

  return [
    // O painel nao corresponde a rota nenhuma da API, entao entra fixo.
    { key: 'home', items: [{ key: 'dashboard', label: t('nav.overview'), icon: 'mdi-view-dashboard-outline', to: '/' }] },
    ...deriveNavGroups(permissions, { overrides, groups }),
  ]
}
