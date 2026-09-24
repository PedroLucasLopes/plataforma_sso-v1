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

A revisão de segurança deste front está em [`PENTEST.md`](PENTEST.md).

A interface fala **inglês, espanhol e português do Brasil**, e a pessoa troca pelo menu com o nome dela,
no canto da barra. Ver "Traduções". **O código não leva comentário**: nome de variável, função e tipo
em inglês, e o que precisa de explicação mora no  do repositório.

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
npm run check:locales # as três línguas contra o en.json, e cada chave usada no código
npm run build        # type-check + check:locales + build
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
- **Erro por código.** O SSO devolve a pessoa com `?error=<código>`, e `loginError`, em
  `constants/messages.ts`, só aceita os códigos da lista dele; o texto mora em `login.errors`. Código
  desconhecido vira mensagem genérica; texto da URL nunca é ecoado.
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

**O que outra pessoa muda chega à tela sem recarregar.** O SSO relê o papel a cada chamada, então a
API já respeitava uma troca feita por outra conta; a tela não, porque `GET /sso/me` era lido uma vez,
na carga da página. `useSessionWatch`, montado no `ConsoleLayout`, relê a sessão a cada
`SESSION_RECHECK_MS` (30 segundos) com a aba visível, e na volta a ela, por foco ou visibilidade:

| O que mudou | O que o console faz |
|---|---|
| papel ou rotas do papel | menu, cabeçalho e ações acompanham sozinhos. Se a tela aberta deixou de ser alcançada, `/forbidden` |
| a pessoa saiu do projeto `SSO` | `/no-access`: a sessão continua, o console não |
| a sessão acabou | login, voltando para a mesma URL |

A `redirect_uri` `http://localhost:5173/callback` vem do SQL de primeira subida do ambiente. Console
em outro endereço precisa ter a sua `…/callback` registrada no projeto `SSO`, pela raiz.

### A raiz e os papéis

`GET /sso/me` traz `root`. A raiz, o `SUPERADMIN` do projeto `SSO`, recebe em `permissions` toda rota
administrativa que o servidor expõe, lida do roteador dele: num ambiente novo, com o catálogo vazio,
ela entra num console completo. Os outros papéis veem o que `Permission` concede, e o que não alcançam
some da tela; se forçarem a chamada, o SSO responde 404.

Papel tem **nome livre** em maiúsculas, dígitos e `_` (`ROLE_NAME_PATTERN`), e o campo converte o que
se digita. O nome gravado é o identificador que o catálogo e o token carregam; a tela o escreve como os
padrão aparecem, só com a primeira letra maiúscula e `_` como espaço (`customRoleLabel`:
`GESTOR_FINANCEIRO` vira "Gestor financeiro"), com o ícone `CUSTOM_ROLE_ICON`, em tom neutro, depois dos
padrão. O resumo do painel diz "Personalizado", porque o ícone sozinho não explica o que marca, e o
campo de nome mostra como o papel vai aparecer.

**Pastilha de papel usa `roleChips`, nunca `ROLE_STATUS` direto.** `ROLE_STATUS` só conhece os quatro
padrão, e o `DlStatusChip` desenha o que não acha no mapa como texto cru, sem ícone.

Cada papel tem, no próprio painel do projeto, o atalho "Grant all GET routes" e as ações de renomear e
apagar. No painel de membros, trocar o papel e tirar do projeto são ações da linha.

---

## 🗣️ Traduções

Todo texto de tela mora em `src/locales`, um JSON por língua: `en.json`, `es.json`, `pt-BR.json`. O
`en.json` é a referência. Nenhum rótulo, mensagem de erro, aviso ou opção fica escrito no código.

- **Língua nova é só um JSON.** `plugins/i18n.ts` registra todo arquivo da pasta pelo
  `import.meta.glob`, e o `DlUserMenu` lista a língua com o nome nela mesma e a bandeira do país, sem
  declaração nenhuma. O arquivo precisa das mesmas chaves do `en.json`.
- **Uma língua só para tudo.** `createDotlogLocale`, em `plugins/vuetify.ts`, liga o Vuetify e os
  componentes da biblioteca ao vue-i18n do console. Os textos dos componentes `Dl*` vêm traduzidos da
  própria biblioteca.
- **A língua inicial** é a que a pessoa escolheu neste navegador, senão a do navegador, senão o
  inglês. A escolha fica em `localStorage`, na chave `dl.locale`. `<html lang>` e o título da aba
  acompanham a troca.
- **No componente,** `const { t } = useI18n()`. **Fora dele,** em store, serviço e constante, o `t` de
  `@/plugins/i18n`. Os dois leem a língua na hora da chamada.
- **Rótulo lido na montagem não troca.** Lista de colunas, ações e opções é `computed`; as pastilhas de
  `constants/status.ts` têm o rótulo num getter. Um array constante com `t()` ficaria na língua do boot.
- **Data e número seguem a língua.** `formatDate` e `formatDateTime` usam a corrente, e `inferColumns`
  recebe `locale`.
- **Erro do backend é traduzido pelo código**, no campo `error`: `ERROR_CODES`, em
  `constants/messages.ts`, lista os que o console conhece, e o texto mora em `errors.code.<código>`. A
  recusa da validação traz o código de cada campo, com texto em `errors.field.<código>`. Código
  desconhecido cai na mensagem do status, e o `message` do servidor **nunca** vai para a tela. O texto
  do erro é o da língua no momento da falha.
- **Plural** é do vue-i18n: `"{count} rota | {count} rotas"` e `t('counts.routes', n)`.
- **`@` literal é `{'@'}`**, senão a mensagem não compila no vue-i18n.

`npm run check:locales` recusa chave faltando ou sobrando, parâmetro ou plural diferente do inglês,
mensagem que não compila e chave usada no código que não existe, e avisa de chave que nada usa. Roda
dentro do `npm run build`, então o container não sobe com tradução quebrada.

---

## 🌳 Rotas e papéis moram dentro do projeto

Não existe tela com as rotas de todas as aplicações. Uma lista assim cresce sem limite e não ajuda
ninguém a achar nada; dentro do projeto, o próprio caminho diz onde cada rota mora. O `GET /route`
continua existindo e continua no papel, mas `navigation.ts` o esconde do menu, e o painel só usa o
catálogo para contar.

**Papéis também não têm tela global.** O `GET /role` continua na API, mas `navigation.ts` o esconde do
menu e o console não o chama: com muitos projetos, ele devolveria os papéis de todos de uma vez. Os
papéis de um projeto chegam no overview dele, e é daí que saem a aba de papéis, o painel de membros e
o diálogo "Add to project" da ficha do usuário, que busca o overview só do projeto escolhido.

**A aba de rotas é árvore e detalhe lado a lado** (`RoutesPanel`, com `DlRouteTree` e `DlMasterDetail`).

- **O caminho é o pai.** `/equipment` › `/equipment/:id` › `/equipment/:id/create`. Prefixo sem rota que
  junta dois caminhos ou mais vira grupo, como `/generate`.
- **Tudo é clicável e abre o detalhe** (`RouteDetail`): os métodos, os parâmetros, o pai, os ids de
  cada método, a matriz de acesso com uma caixa por papel, quem pode chamar e o que mora abaixo.
  Método que nenhum papel alcança sai marcado na árvore, porque responde 404 a todo mundo.
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
├─ 📄 pages/         # Login, Callback, NoAccess, Unavailable, Dashboard, projects/, users/, ClientKeys
├─ 🧩 components/    # ClientKeysPanel · project/ (checklist, redirect URIs, rotas e detalhe, papéis, membros)
├─ 🗃️ stores/        # session, preferences, catalog, projects, clientKeys, users
├─ 🔌 services/      # http.ts (erro, CSRF, 401, 404 vazio) · sso.ts (endpoints por recurso)
├─ 🗣️ locales/       # en.json (referência), es.json, pt-BR.json: todo texto de tela
├─ 🔧 plugins/       # i18n.ts (vue-i18n, língua inicial, `t` fora de componente) · vuetify.ts
├─ 🎨 constants/     # theme, layout, api, navigation, status, messages (códigos → chaves)
├─ 🧰 composables/   # useCrudDialog · useConfirm · useGrants · useSessionWatch (relê a sessão)
├─ 🔤 types/         # sso.ts, espelho dos DTOs do backend
└─ 🛠️ utils/         # format.ts · forms.ts · routes.ts (rotas do overview no formato da árvore)
```

## 🎨 Estilo em constantes

`constants/theme.ts` organiza cor de fundo, superfície, fontes, espaçamento, raio, elevação e
movimento. **Nenhum valor nasce ali**: tudo sai dos tokens de `@pedrolucaslopes/dotlog-ui`, que
passaram pela conferência de contraste. No template, prefira a classe do tema (`bg-surface`) ou a
variável (`var(--dl-surface)`), que trocam sozinhas com o tema. A constante serve ao que não enxerga
CSS, como a cor de um gráfico.

**A marca do SSO é o escudo com chave.** `APP_LOGO`, em `constants/layout.ts`, vai ao topo do menu
pelo `logo` do `DlAppShell` e à tela de login pelo do `DlSignIn`; `public/favicon.svg` desenha o mesmo
ícone na aba. Arquivo estático não lê constante nem token, então ele repete à mão o desenho, o
`primary` e o `onPrimary` da biblioteca, com a versão escura por `prefers-color-scheme`. Mudou a marca
ou a paleta, mude o ícone da aba junto.

**O painel não deixa buraco.** Cartões e gráficos são flex, com `flex: 1 1 <piso>` e `min-width: 0`:
cabem quantos a largura permitir, e quem sobra na última linha cresce até a borda. A grade
`repeat(auto-fit, minmax(...))` mantinha a largura das colunas na última linha e deixava o resto dela
vazio. O piso dos cartões é `STAT_CARD_MIN_WIDTH`, em `constants/layout.ts`.

`constants/layout.ts` guarda nome e marca da aplicação, largura do conteúdo, piso dos cartões do
painel, tamanho de página e debounce. `status.ts` guarda as
pastilhas de situação, papel, método e chave, e `navigation.ts` o que o banco não guarda do menu.

## 🗃️ Estado

- **`session`**: quem entrou, permissões, token anti-CSRF e todo o ciclo de login e logout.
- **`catalog`**: lista inteira de cada recurso até `LOOKUP_LIMIT`, para seletor, nome no lugar de id e
  painel. Projetos filtram e paginam no navegador; usuários paginam no servidor. Papéis não têm lista
  global, e rotas entram só na contagem do painel: os dois moram no overview de cada projeto.
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
| Erro sai com código em `error` | `apiErrorText`, em `constants/messages.ts`: código conhecido vira texto, o resto cai no status |
| Apagar rota ou papel com permissão falha no banco | a ação fica desabilitada até a permissão sair |
| Rota não guarda data nem autor | o detalhe do caminho sai inteiro do overview, sem chamada a mais |
| Um papel por pessoa por projeto | trocar o papel e tirar do projeto são ações da linha, em `MembersPanel` |
| Rota que o papel não alcança responde 404 | a tela esconde antes; um 404 inesperado vira a mensagem de registro não encontrado |
| O projeto `SSO` é protegido no servidor | `SELF_PROJECT_NAME` e `session.root`: renomear, suspender e apagar somem para todos; catálogo, membros, redirect URIs e chaves do SSO somem para quem não é a raiz, com aviso no rodapé |
| O `SUPERADMIN` do SSO é a raiz e sempre sobra um | o papel não oferece renomear nem apagar; o último `SUPERADMIN` não troca de papel nem sai |
| Redirect URI do `SSO` não se edita; a última e a desta origem não saem | a ação fica indisponível na linha. Nas outras aplicações, apagar pede confirmação |
| `authId: null` em `PUT /user/:id` desfaz o vínculo com o Google | ação "Unlink Google account" |

---

## 🚀 CI/CD

**O trabalho nasce numa branch `feat/*`, `fix/*` ou `bugfix/*`, vai por pull request para a `development`
e só chega na `main` por um segundo pull request, revisado à mão.** As duas branches exigem pipeline verde
e recusam push direto. O fluxo inteiro está em [`ecossistema.md`](https://github.com/PedroLucasLopes/sso-api-v1/blob/main/docs/ecossistema.md).

`.github/workflows/ci.yml`, no GitHub Actions:

| Quando | O que roda |
|---|---|
| pull request e push na `main` | `npm ci`, `npm audit` (produção sem aviso nenhum; o resto, sem alto), lint e build, que roda o type-check e confere as traduções |
| pull request | a imagem é montada, sem publicar |
| push na `main`, tag `v*` e à mão | a imagem do front, o nginx com o build, vai para o GitHub Container Registry, `ghcr.io/pedrolucaslopes/plataforma_sso-v1`, com a tag do commit, `main` e a versão, proveniência e SBOM |

- **O pacote privado.** O `npm ci` e o build da imagem leem `@pedrolucaslopes/dotlog-ui` com o `GITHUB_TOKEN` da
  execução, quando o pacote libera leitura a este repositório (nas configurações do pacote, "Manage
  Actions access"), ou com o secret `PACKAGES_READ_TOKEN`, um token clássico com `read:packages`. Sem um
  dos dois, o `npm ci` do pipeline responde 403.
- **O pipeline é superfície de ataque.** Actions fixadas por commit, `permissions: {}` no topo e o
  mínimo por job, checkout sem credencial persistida, sem `pull_request_target`, e o token do npm como
  secret do BuildKit. O Dependabot (`.github/dependabot.yml`) abre pull request para as actions e a
  imagem base toda semana; o npm fica de fora, porque o pacote privado pede um token próprio dele.
- **O deploy ainda não existe.** A imagem publicada é o artefato. O alvo é o Firebase Hosting, com os
  rewrites de `/api` e `/sso` numa origem só, e entra quando houver o projeto no GCP.

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
- Texto de tela vai para `src/locales`, nas três línguas, e sai por `t()`. Nada de rótulo, mensagem
  ou opção escrito no componente, na store ou na constante.
- Rótulo que depende da língua é lido na hora de desenhar: `computed`, template ou getter.
- Toda escrita passa por `services/http.ts`, que anexa o `X-CSRF-Token`.
- Texto de erro sai do código em `error`, ou do status. O `message` do servidor nunca vai para a tela.
- `useSessionWatch` fica montado no `ConsoleLayout`. Sem ele, papel trocado por outra conta só chega ao
  menu depois de recarregar.
- Tela nova declara `meta.permission` com o mesmo método e caminho do catálogo do SSO.
- Ação que o papel não alcança sai do DOM; desabilitar fica para bloqueio por estado.
- Rota e papel de aplicação não ganham lista global. Aparecem dentro do projeto deles.
- O console não oferece o que o servidor recusa no projeto `SSO`. A regra vale no servidor; a tela só
  evita o caminho fechado, e a mensagem de cada recusa vem do código dela, em `errors.code`.
- Nome de papel é texto livre. Nada na tela depende de a lista de papéis ser fixa.
- Rode `npm run type-check`, `npm run lint` e `npm run check:locales` antes de considerar pronto.
