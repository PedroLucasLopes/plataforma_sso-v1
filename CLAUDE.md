# 🖥️ SSO Plataforma — tela de login do IdP e console do SSO

Front do Authorization Server. Mora aqui a **tela de login do IdP**, a mesma para toda aplicação do
ecossistema, e o **console** onde se administram projetos, usuários, rotas, papéis, permissões,
redirect URIs e chaves de cliente.

| Repositório | Papel |
|---|---|
| [`sso-api-v1`](https://github.com/PedroLucasLopes/sso-api-v1) | Authorization Server + catálogo RBAC · NestJS, prefixo `/sso`, porta 8080 |
| `plataforma_sso-v1` (este) | tela de login do IdP + console · Vue 3, Vuetify 4, Pinia · porta 5173 |
| [`components_storybook-v1`](https://github.com/PedroLucasLopes/components_storybook-v1) | `@pedrolucaslopes/dotlog-ui`: componentes, tema e Storybook, instalado pelo npm |

**Todo componente de tela vem de `@pedrolucaslopes/dotlog-ui`.** Componente novo nasce no Storybook,
no repositório da biblioteca, sai numa versão publicada, e só depois é consumido aqui. O que mora
neste projeto é composição com regra de domínio: painéis do projeto, páginas e stores. Regras de
estilo do scaffold em `AGENTS.md`; o ESLint decide o formato.

A interface é em **inglês**; comentário em português, como no resto do repositório.

---

## ⚡ Stack

- **Vue 3.5** (`<script setup>`) · **TypeScript 5.9** · **Vite 8**
- **Vuetify 4** com `vite-plugin-vuetify` (`autoImport`)
- **Pinia 3** em setup stores · **vue-router 5**, rotas declaradas à mão
- **Tailwind 4** para layout. Cor, fonte, raio e movimento vêm dos tokens da biblioteca de UI
- **`@pedrolucaslopes/dotlog-ui` pelo npm**, do GitHub Packages. Nada de alias, `paths` ou `../ui`

## 🏃 Comandos

```bash
npm install          # exige NODE_AUTH_TOKEN (read:packages) para baixar a biblioteca de UI
npm run dev          # Vite na 5173, com proxy de /sso para localhost:8080
npm run type-check   # vue-tsc
npm run lint:fix
npm run build        # type-check + build
```

O SSO precisa estar de pé na 8080, pelo compose do `sso-api-v1` ou por `npm run start:dev` nele. Para outro
endereço, use `SSO_DEV_PROXY=http://host:porta`.

**Testar mudança da biblioteca antes de publicar.** Na biblioteca, `npm run build` e
`npm pack --pack-destination <pasta fora dos projetos>`; aqui, `npm install --no-save <arquivo .tgz>`.
O `package.json` e o lockfile não mudam, e a próxima instalação normal volta para a versão publicada.

> ⚠️ **A 5173 é disputada.** O container `sso-plataforma` publica na mesma porta, que é a registrada
> como `redirect_uri` e como `SSO_LOGIN_URL`. Para rodar o Vite, pare o container antes:
> `docker compose stop sso-plataforma`.

---

## 🔐 Como o login funciona

### A tela de login do IdP (`/login`)

É para onde o SSO manda qualquer pessoa sem sessão, venha ela do KRLoc, de outra aplicação ou do
próprio console.

- **Só oferece provedor com pedido pendente.** A tela consulta `GET /sso/login/request`. Com pedido,
  mostra "Sign in to continue to <aplicação>" e o botão do Google; sem pedido, explica que o login
  começa pela aplicação e não mostra botão nenhum. Não há caminho para criar pedido a partir daqui.
- **Erro por código.** O SSO devolve a pessoa com `?error=<código>`, e `constants/messages.ts`
  traduz. Código desconhecido vira mensagem genérica; texto da URL nunca é ecoado.
- **O botão escolhido trava** enquanto navega ao Google, e destrava se a pessoa voltar pelo botão do
  navegador (`pageshow` com `persisted`).
- **Não é embutível.** `X-Frame-Options: DENY` e `frame-ancestors 'none'`, no Vite e no nginx.

### O console

Entra como qualquer aplicação e depois usa a **sessão do próprio SSO**, na mesma origem da API
(RFC 10017 §7.1). Nenhum token chega ao JavaScript.

1. O guard do router chama `GET /sso/me`. 401 significa sem sessão.
2. `session.beginLogin(returnTo)` gera um `state`, guarda na `sessionStorage` com a URL de volta e
   navega para `/sso/session/login?redirect_uri=<origem>/callback&state=…`.
3. O SSO confere a `redirect_uri` contra as do projeto `SSO`, por igualdade exata. Sem sessão, manda à
   tela de login; com sessão, volta direto.
4. `/callback` confere o `state` e volta para a tela que a pessoa tinha pedido.

| Situação | O que o console faz |
|---|---|
| `GET /sso/me` responde 403 | sessão válida sem papel no projeto `SSO`: tela `/no-access`, com "Use another account" |
| 401 no meio do uso | relogin automático, voltando para a mesma URL |
| SSO fora do ar | tela `/unavailable`, que só oferece tentar de novo |
| rota sem permissão | tela `/forbidden`; menu, cabeçalho e tabela já escondem o que o papel não alcança |

**Escrita leva `X-CSRF-Token`.** O token chega em `GET /sso/me`, ou em `GET /sso/session` para quem
entrou sem papel, e fica só na memória do store. A camada HTTP anexa em todo método que muda estado.

**Logout** é `POST /sso/session/logout`: encerra a sessão do SSO e derruba a renovação de todas as
aplicações. Em seguida o console pede login de novo, e a pessoa cai na tela do IdP.

A `redirect_uri` `http://localhost:5173/callback` foi cadastrada pelo `bootstrap-sso.js`. Console em
outro endereço precisa ter a sua `…/callback` registrada no projeto `SSO`.

---

## 🌳 Rotas moram dentro do projeto

Não existe tela com as rotas de todas as aplicações. Uma lista assim cresce sem limite e não ajuda
ninguém a achar nada; dentro do projeto, o próprio caminho diz onde cada rota mora. O `GET /route`
continua existindo e continua no papel, mas `navigation.ts` o esconde do menu, e o painel só usa o
catálogo para contar.

**A aba de rotas é árvore e detalhe lado a lado** (`RoutesPanel`, com `DlRouteTree` e `DlMasterDetail`).

- **O caminho é o pai.** `/equipment` › `/equipment/:id` › `/equipment/:id/create`. Prefixo sem rota que
  junta dois caminhos ou mais vira grupo, como `/generate`.
- **Tudo é clicável e abre o detalhe** (`RouteDetail`): os métodos, os parâmetros, o pai, os ids de
  cada método, a matriz de acesso com uma caixa por papel, quem pode chamar e o que mora abaixo.
  Método que nenhum papel alcança sai marcado na árvore, porque responde 403 a todo mundo.
- **O caminho escolhido mora na URL**, em `?route=`. Recarregar, voltar e compartilhar abrem o mesmo
  detalhe. Trocar de aba tira o parâmetro.
- **Estreito, o detalhe toma o lugar da árvore** e abrir entra no histórico: o voltar do navegador, ou
  do telefone, volta para a árvore. Lado a lado, trocar de caminho não empilha uma entrada por clique.
- **Criar, editar e apagar acompanham a rota.** Depois de salvar, o detalhe é o do caminho gravado;
  apagar o último método de um caminho leva ao pai.

**A aba de papéis usa a mesma árvore**, com uma caixa por método. A linha só abre e fecha, e o detalhe
do caminho fica num botão ao lado: um clique distraído não tira a pessoa do papel que ela editava.
Conceder e revogar moram em `composables/useGrants.ts`, usado pelos dois lados.

---

## 📁 Estrutura

```bash
💻 src/
├─ 🧭 router/        # rotas, guard de sessão e de permissão, barra de carregamento
├─ 🧱 layouts/       # ConsoleLayout (DlAppShell) · GateLayout (telas sem menu)
├─ 📄 pages/         # Login, Callback, NoAccess, Unavailable, Dashboard, projects/, users/, Roles, ClientKeys
├─ 🧩 components/    # ClientKeysPanel · project/ (checklist, redirect URIs, rotas e detalhe, papéis, membros)
├─ 🗃️ stores/        # session, preferences, catalog, projects, clientKeys, users, roles
├─ 🔌 services/      # http.ts (erro, CSRF, 401, 404 vazio) · sso.ts (endpoints por recurso)
├─ 🎨 constants/     # theme, layout, api, navigation, status, messages
├─ 🧰 composables/   # useCrudDialog · useConfirm · useGrants
├─ 🔤 types/         # sso.ts, espelho dos DTOs do backend
└─ 🛠️ utils/         # format.ts · forms.ts · routes.ts (rotas do overview no formato da árvore)
```

## 🎨 Estilo em constantes

`constants/theme.ts` organiza cor de fundo, superfície, fontes, espaçamento, raio, elevação e
movimento. **Nenhum valor nasce ali**: tudo sai dos tokens de `@pedrolucaslopes/dotlog-ui`, que
passaram pela conferência de contraste. No template, prefira a classe do tema (`bg-surface`) ou a
variável (`var(--dl-surface)`), que trocam sozinhas com o tema. A constante serve ao que não enxerga
CSS, como a cor de um gráfico.

`constants/layout.ts` guarda largura do conteúdo, tamanho de página e debounce. `status.ts` guarda as
pastilhas de situação, papel, método e chave, e `navigation.ts` o que o banco não guarda do menu.

## 🗃️ Estado

- **`session`**: quem entrou, permissões, token anti-CSRF e todo o ciclo de login e logout.
- **`catalog`**: lista inteira de cada recurso até `LOOKUP_LIMIT`, para seletor, nome no lugar de id e
  painel. Projetos e papéis filtram e paginam no navegador; usuários paginam no servidor. Rotas não
  têm lista própria: entram só na contagem do painel.
- **`projects`**: projeto e overview. Toda escrita relê o overview em vez de remendar estado local, e a
  árvore de rotas é montada dele a cada leitura.
- **`clientKeys`**: chaves por projeto. ⚠️ **A chave privada gerada nunca entra em store.** Ela vive
  num `ref` do painel enquanto o `DlSecretDialog` está aberto, e some quando ele fecha.

## 🔌 O backend que a tela precisa conhecer

| Comportamento | Onde é tratado |
|---|---|
| Listagem vazia responde 404 | `request(..., { emptyOn404: true })` devolve `[]` |
| Não há total de registros | tabela com paginação cega; no catálogo, `pageLimit` evita "Next" sem próxima |
| `limit` com piso 10 e sem teto | `PAGE_SIZE = 20`, `LOOKUP_LIMIT = 500` |
| Filtro `email` exige endereço completo | a busca manda texto com cara de e-mail como `email`, e o resto como `name` |
| Mensagens de erro em português | `API_MESSAGES` traduz as conhecidas; a validação do class-validator já vem em inglês |
| Apagar rota ou papel com permissão falha no banco | a ação fica desabilitada até a permissão sair |
| Rota não guarda data nem autor | o detalhe do caminho sai inteiro do overview, sem chamada a mais |
| Não há rota para tirar membro nem apagar redirect URI | o console não oferece, e o painel de membros avisa |
| `authId: null` em `PUT /user/:id` desfaz o vínculo com o Google | ação "Unlink Google account" |

---

## 🐳 Container

`docker compose up -d --build`, na raiz deste repositório e num terminal com `NODE_AUTH_TOKEN`, sobe
só o console, com contexto na própria pasta. A biblioteca de UI chega pelo `npm ci`, do GitHub
Packages: o `.npmrc` versionado diz onde buscar e lê o token de `NODE_AUTH_TOKEN`, que entra como
**secret do BuildKit** (`--mount=type=secret,env=NODE_AUTH_TOKEN`). Ele existe só durante aquele
`RUN` e não fica em camada nenhuma; `ARG` e `ENV` ficariam gravados na imagem. O compose declara o
secret a partir do ambiente de quem roda o build.

O nginx é um template. `SSO_UPSTREAM`, que no compose é `http://host.docker.internal:8080`, a porta do
SSO na máquina, liga o repasse de `/sso`
para o SSO, o mesmo papel do proxy do Vite. Vazio, `/sso` responde 404, que é o caso de produção:
lá o rewrite do hosting roteia `/sso` antes de a chamada chegar ao nginx.

## 🚨 Armadilhas já pagas

⚠️ **O CSS dos componentes `Dl*` não vem sozinho.** Ele é compilado no pacote e entra por
`import '@pedrolucaslopes/dotlog-ui/styles'`, em `plugins/vuetify.ts`, depois de `vuetify/styles`.
Sem essa linha a tela monta, os componentes funcionam, e tudo aparece sem forma nenhuma, sem erro.

⚠️ **O nginx não lê o `/etc/hosts`.** Com `proxy_pass` montado de variável, o nome de `SSO_UPSTREAM` é
resolvido a cada requisição no DNS do Docker, o `resolver 127.0.0.11`, e `extra_hosts` não ajuda. O
Docker Desktop responde `host.docker.internal` nesse DNS; em Docker Engine no Linux, use o IP do host.

⚠️ **`add_header` num `location` do nginx descarta os herdados do `server`.** O `location` do
`index.html` só mandava `Cache-Control`, e a tela de login saía sem `X-Frame-Options`. Todo `location`
que declara header repete os de segurança.

⚠️ **Os temas se chamam `dotlogLight` e `dotlogDark`.** As variantes `light` e `dark` do Tailwind
apontam para essas classes, e não para as `v-theme--light/dark` do scaffold.

⚠️ **`lib` em ES2023.** O ESLint do Vuetify exige `toSorted`, que o `@vue/tsconfig` não declara.

⚠️ **Espalhar `route.query` perde as chaves.** O tipo é um `Record`, e o TypeScript descarta a
assinatura de índice no espalhamento: `{ ...route.query, tab }` vira `{ tab: string }`, e ler
`query.route` depois não compila. Tire a chave por desestruturação (`const { route, ...others }`).

⚠️ **Verificação em aba escondida engana.** Com o painel do navegador oculto, `requestAnimationFrame`
e as transições param: gráfico parece preso em "Loading", número parado em zero, e linha de lista
que devia ter saído continua na tela. Confira o DOM antes de chamar de defeito.

## ✅ Invariantes ao alterar

- Componente de tela vem de `@pedrolucaslopes/dotlog-ui`, pelo npm. Componente novo nasce lá, com
  story nos dois temas, e chega aqui por versão publicada. Nunca por caminho relativo.
- Nenhum token de acesso, chave privada ou segredo em store, `localStorage`, log ou URL.
- `NODE_AUTH_TOKEN` só no ambiente. Nunca no `.npmrc`, no Dockerfile como `ARG`, ou em arquivo versionado.
- A tela de login só mostra texto de erro a partir de código conhecido.
- Toda escrita passa por `services/http.ts`, que anexa o `X-CSRF-Token`.
- Tela nova declara `meta.permission` com o mesmo método e caminho do catálogo do SSO.
- Ação que o papel não alcança sai do DOM; desabilitar fica para bloqueio por estado.
- Rota de aplicação não ganha lista global. Ela aparece dentro do projeto dela.
- Rode `npm run type-check` e `npm run lint` antes de considerar pronto.
