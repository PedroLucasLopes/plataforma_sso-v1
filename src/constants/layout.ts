/** Nome da aplicacao no menu e no titulo da aba. */
export const APP_NAME = 'SSO'
export const APP_SUBTITLE = 'Admin console'

/** Largura maxima do conteudo. Acima disso sobra margem, nao linha comprida. */
export const CONTENT_MAX_WIDTH = 1280

/** Linhas por pagina nas listas paginadas pelo servidor. O backend tem piso de 10. */
export const PAGE_SIZE = 20

/**
 * Teto das consultas de apoio: seletor de projeto, nome no lugar de id, painel.
 * O backend nao impoe teto ao `limit`; este e o nosso.
 */
export const LOOKUP_LIMIT = 500

/** Espera antes de buscar enquanto a pessoa digita um filtro. */
export const FILTER_DEBOUNCE_MS = 350

/** Largura minima de cada cartao na grade de indicadores. */
export const STAT_CARD_MIN_WIDTH = '210px'

/** Preferencia de menu recolhido, por navegador. */
export const NAV_COLLAPSED_STORAGE_KEY = 'sso.console.nav-collapsed'
