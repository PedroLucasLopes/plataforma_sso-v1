import {
  deriveNavGroups,
  type NavGroup,
  type NavItem,
  type NavOverride,
  type Permission,
} from '@pedrolucaslopes/dotlog-ui'

/**
 * O menu sai das permissoes do papel, por `deriveNavGroups`: cada `GET` de um
 * segmento vira item. Daqui vem so o que o banco nao guarda: rotulo, icone,
 * grupo, ordem e a rota do front.
 *
 * `/permission`, `/projectuser` e `/redirecturi` nao tem `GET` e nao viram
 * item: sao geridos dentro da tela do projeto.
 *
 * `/route` tem `GET` e mesmo assim fica fora. Todas as rotas de todas as
 * aplicacoes numa lista so crescem sem limite e nao ajudam ninguem a achar
 * nada; dentro do projeto, em arvore, o proprio caminho diz onde cada uma mora.
 */
export const NAV_GROUPS = [
  { key: 'catalogue', title: 'Catalogue' },
  { key: 'credentials', title: 'Credentials' },
]

export const NAV_OVERRIDES: Record<string, NavOverride> = {
  '/project': { label: 'Projects', icon: 'mdi-apps', to: '/projects', group: 'catalogue', order: 1 },
  '/user': { label: 'Users', icon: 'mdi-account-multiple-outline', to: '/users', group: 'catalogue', order: 2 },
  '/role': { label: 'Roles', icon: 'mdi-shield-account-outline', to: '/roles', group: 'catalogue', order: 3 },
  '/route': { hidden: true },
  '/clientkey': { label: 'Client keys', icon: 'mdi-key-variant', to: '/client-keys', group: 'credentials', order: 1 },
}

/** O painel nao corresponde a rota nenhuma da API, entao entra fixo. */
export const HOME_NAV_ITEM: NavItem = {
  key: 'dashboard',
  label: 'Overview',
  icon: 'mdi-view-dashboard-outline',
  to: '/',
}

export function buildNavGroups (permissions: Permission[]): NavGroup[] {
  return [
    { key: 'home', items: [HOME_NAV_ITEM] },
    ...deriveNavGroups(permissions, { overrides: NAV_OVERRIDES, groups: NAV_GROUPS }),
  ]
}
