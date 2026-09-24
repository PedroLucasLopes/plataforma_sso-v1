import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import Vue from '@vitejs/plugin-vue'
import Fonts from 'unplugin-fonts/vite'
import { defineConfig } from 'vite'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

/** Onde o SSO atende em desenvolvimento. O navegador fala so com o Vite. */
const ssoTarget = process.env.SSO_DEV_PROXY ?? 'http://localhost:8080'

/**
 * O console e a tela de login do IdP moram aqui, e nenhuma das duas pode ser
 * embutida em pagina de terceiro: clickjacking na tela de autorizacao e o caso
 * que a RFC 6749 secao 10.13 descreve. O nginx de producao repete os headers.
 */
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': 'frame-ancestors \'none\'',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    Vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    Fonts({
      fontsource: {
        families: [
          {
            name: 'Roboto Mono',
            weights: [400, 700],
          },
          {
            name: 'Roboto',
            weights: [100, 300, 400, 500, 700, 900],
            styles: ['normal', 'italic'],
          },
        ],
      },
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
    // `@pedrolucaslopes/dotlog-ui` declara `vue` e `vuetify` como peer. Com o
    // pacote ligado por `npm link`, a resolucao partiria da pasta dele e traria
    // outra copia; duas instancias do Vue quebram `inject` e o tema.
    dedupe: ['vue', 'vuetify'],
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  server: {
    // A mesma porta registrada como redirect_uri do projeto SSO pelo bootstrap.
    port: 5173,
    strictPort: true,
    headers: securityHeaders,
    // Mesma origem para front e API: sem CORS, e o cookie SameSite=Strict vale.
    proxy: {
      '/sso': { target: ssoTarget },
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
    headers: securityHeaders,
    proxy: {
      '/sso': { target: ssoTarget },
    },
  },
})
