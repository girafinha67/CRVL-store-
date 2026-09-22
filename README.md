# CRVL Store — Site + Catálogo + Painel Administrativo

Site institucional (HTML/CSS/JS puro, preservado como estava) + catálogo de
produtos e painel admin novos, rodando em Netlify Functions (Express) com
banco Postgres via Supabase.

## Estrutura
```
crvl-store/
├── public/                    ← pasta publicada pelo Netlify
│   ├── index.html              (existente — inclui o script de tracking)
│   ├── catalogo.html           (catálogo público)
│   ├── produto.html            (página de detalhe do produto)
│   ├── assets/                 (existente, intocado)
│   ├── css/
│   │   ├── catalogo.css        (componentes do catálogo/admin)
│   │   └── analytics.css       (novo — componentes do painel de Analytics)
│   ├── js/
│   │   ├── api.js              (wrapper fetch)
│   │   ├── catalogo.js
│   │   ├── produto.js
│   │   ├── admin-common.js     (guard/logout/toast)
│   │   ├── admin-produtos.js
│   │   ├── admin-categorias.js
│   │   ├── analytics-track.js  (novo — tracking de visitante, roda no site público)
│   │   ├── analytics-charts.js (novo — gráficos SVG leves, sem lib externa)
│   │   └── admin-analytics.js  (novo — controlador da tela de Analytics)
│   └── admin/
│       ├── login.html
│       ├── index.html          (dashboard)
│       ├── produtos.html       (CRUD de produtos)
│       ├── categorias.html     (CRUD de categorias)
│       └── analytics.html      (novo — 📊 Análise de usuários)
├── netlify/functions/          ← backend (Netlify Functions)
│   ├── api.js                  (entrypoint Express)
│   ├── lib/ (db, auth, upload, rate-limit, http-utils,
│   │        ua-parse, traffic-source, geo, analytics-range,
│   │        analytics-queries, csv — os 6 últimos são novos, do Analytics)
│   └── routes/ (auth, products, categories, uploads, dashboard,
│                track [novo, público], analytics [novo, admin])
├── netlify.toml
├── package.json
└── .env.example
```

## 1. Variáveis de ambiente necessárias (Netlify → Site configuration → Environment variables)

| Variável | Descrição |
|---|---|
| `SUPABASE_DB_POOLER_URL` | Connection string do Supabase (Session Pooler) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (só no backend, nunca no frontend) |
| `ADMIN_EMAIL` | E-mail do primeiro/único administrador |
| `ADMIN_PASSWORD` | Senha do administrador (defina só no Netlify, nunca no repo) |

`NODE_ENV` **não precisa mais ser configurada manualmente**: o cookie de
sessão já detecta sozinho se está rodando num deploy real do Netlify
(sempre HTTPS → cookie `Secure`) ou em `netlify dev` local (HTTP →
sem `Secure`). Só defina `NODE_ENV=development` se quiser forçar esse modo
em outro tipo de ambiente local.

## 2. Antes do primeiro deploy
1. Crie um projeto no Supabase (se ainda não tiver um).
2. Em **Storage**, crie um bucket público chamado `crvl-images`.
3. Configure as 6 variáveis acima no Netlify.
4. Deploy normal (`git push` ou arrastar a pasta). O backend cria as tabelas
   e o administrador sozinho no primeiro request (não precisa rodar SQL manual).

## 3. Migrations / banco de dados
Não há SQL para rodar manualmente. `netlify/functions/lib/db.js` roda
`CREATE TABLE IF NOT EXISTS` de forma idempotente a cada cold start,
e semeia 4 categorias iniciais (Tênis, Conjuntos, Camisetas, Calçados) se a
tabela estiver vazia. Tabelas criadas: `admins`, `sessions`, `categories`,
`products`, `settings`, `logs`, `rate_hits`, `analytics_visitors`,
`analytics_sessions`, `analytics_events` (as 3 últimas são do Analytics —
ver seção 9).

## 4. Como acessar o painel administrativo
`https://seudominio.com.br/admin/` → tela de login → e-mail/senha definidos
em `ADMIN_EMAIL`/`ADMIN_PASSWORD`. O link "Admin" está discretamente no
rodapé do site (opacidade baixa, ao lado do copyright).

## 5. Como promover/trocar o administrador
O sistema opera com um único administrador fixo, sincronizado com
`ADMIN_EMAIL`/`ADMIN_PASSWORD` a cada deploy: mude essas duas variáveis no
Netlify e faça um novo deploy (ou aguarde o próximo cold start) — o e-mail e
a senha do admin são atualizados automaticamente. Não há cadastro público de
administradores.

## 6. Como funciona o "dispositivo confiável"
Não existe uma tabela separada de dispositivos — a própria sessão é o
mecanismo: ao marcar "Lembrar deste dispositivo por 30 dias" no login, o
servidor cria uma sessão de 30 dias (em vez de 8 horas) e guarda no navegador
só um token aleatório assinado (cookie `crvl_session`, HttpOnly, nunca
acessível por JavaScript). A senha nunca é salva. Isso já cobre os
requisitos do briefing: expira sozinho, pode ser revogado a qualquer momento
(`DELETE /api/admin/devices/:id`), e "Sair deste dispositivo" apaga só a
sessão atual (`POST /api/auth/logout`).

## 7. Analytics (📊 Análise de usuários)
Sistema de Analytics próprio (não é Google Analytics/Meta Pixel) — os dados
ficam só no seu Supabase. Acesse em `/admin/analytics.html` (link no menu
lateral do painel).

### Como funciona, de ponta a ponta
1. **Coleta**: `public/js/analytics-track.js` roda em `index.html`,
   `catalogo.html` e `produto.html`. Ele gera um `visitor_id` anônimo
   (localStorage) e um `session_id` (sessionStorage, expira sozinho após
   30min sem atividade ou ao fechar a aba), e manda eventos para
   `POST /api/track` via `navigator.sendBeacon` (não bloqueia a navegação).
2. **Eventos automáticos**: `session_start`/`page_view` ao carregar
   qualquer página; `whatsapp_click` em qualquer link `wa.me` do site
   (delegado — funciona nos botões que já existiam, sem precisar editar
   cada um); `product_view` em `produto.html`; `search` e `category_view`
   no catálogo (`catalogo.js`).
3. **Preparado para o futuro**: a validação em `track.routes.js` já aceita
   `add_to_cart`, `checkout_start`, `purchase` e `login`, mas nenhuma tela
   do site dispara isso ainda (não existe carrinho/checkout/login de
   cliente hoje) — é só a arquitetura ficando pronta, como pedido.
4. **Armazenamento**: `netlify/functions/lib/db.js` cria 3 tabelas —
   `analytics_visitors` (1 linha por visitante anônimo), `analytics_sessions`
   (1 linha por sessão, com origem/dispositivo/localização resumidos) e
   `analytics_events` (1 linha por evento). Índices cobrem toda consulta
   por data/evento/sessão/visitante/produto usada pelo painel.
5. **Painel**: `netlify/functions/lib/analytics-queries.js` tem uma função
   por bloco do dashboard (overview, série temporal, origens, dispositivos,
   localização, produtos, categorias, páginas, horários, tempo real) — só
   agregações com `WHERE` por data e `GROUP BY`, nunca um `SELECT *` sem
   filtro. As mesmas funções alimentam a exportação em CSV.
6. **Tempo real**: não há WebSocket/Supabase Realtime — o painel faz
   polling de `/api/admin/analytics/realtime` a cada 15s (e do resto dos
   cards a cada 60s). Funciona bem com Netlify Functions (que não mantém
   conexões abertas) e não sobrecarrega o banco.

### Dados coletados x privacidade/LGPD (briefing item 25)
- **Nunca é salvo**: IP completo, GPS do navegador, senha, dado de
  formulário, CPF ou qualquer identificação pessoal.
- **Localização**: por padrão **desligada** (nenhuma chamada externa,
  nenhuma coluna de localização preenchida). Se quiser habilitar
  aproximação por país/estado/cidade (nunca coordenadas exatas), configure
  no Netlify:
  - `IPGEO_PROVIDER=ipapi` — usa https://ipapi.co (grátis até ~1.000
    consultas/dia; para mais volume, gere uma chave lá e configure também
    `IPGEO_API_KEY`). Só é consultado 1x por sessão (no primeiro evento),
    nunca por evento, para minimizar chamadas externas.
  - Deixando `IPGEO_PROVIDER` sem configurar (ou vazio), a tela mostra
    "Localização aproximada não está habilitada" em vez de inventar dados.
- **Retenção**: eventos e sessões são apagados automaticamente depois de
  `ANALYTICS_RETENTION_DAYS` dias (padrão 400 — permite comparar "este mês"
  com "o mesmo mês ano passado"). Roda dentro do `pruneOldData()` que já
  existia (best-effort, não bloqueia requests).
- **Liga/desliga**: o interruptor no topo de `/admin/analytics.html`
  desativa a coleta a qualquer momento (`POST /api/track` passa a responder
  sem gravar nada). Fica salvo na tabela `settings` (`analytics_enabled`).

### Variáveis de ambiente (todas opcionais — nada aqui é obrigatório)
| Variável | Padrão | Descrição |
|---|---|---|
| `ANALYTICS_RETENTION_DAYS` | `400` | Dias até um evento/sessão antigo ser apagado. |
| `IPGEO_PROVIDER` | *(vazio = desligado)* | `ipapi` para habilitar localização aproximada por IP. |
| `IPGEO_API_KEY` | *(vazio)* | Chave do ipapi.co, só necessária acima do tier grátis. |

### Endpoints criados
Públicos: `POST /api/track` (ingestão de eventos, com rate limit por
visitante e allowlist fechada de nomes de evento).

Administrativos (exigem sessão — protegidos pelo mesmo middleware que já
protegia `/admin/dashboard`):
`GET /api/admin/analytics/{overview,timeseries,sources,devices,locations,
products,categories,pages,hours,realtime,settings}`,
`PUT /api/admin/analytics/settings`,
`GET /api/admin/analytics/export?dataset=...&range=...` (CSV).

### Limitações conhecidas
- **Página de saída** é estimada como a última página vista na sessão
  (não existe um evento de "saindo da página" — beacons de `unload` são
  historicamente pouco confiáveis em navegadores mobile). Fica claro na
  própria tela ("Estimado a partir da última página vista").
- **Localização** depende de configurar `IPGEO_PROVIDER` (ver acima); sem
  isso, o painel mostra o aviso em vez de dado.
- Dispositivo/navegador/SO usam um parser de User-Agent próprio e leve
  (`lib/ua-parse.js`), não uma biblioteca completa — cobre os casos comuns
  (Chrome/Safari/Firefox/Edge, Windows/macOS/Android/iOS/Linux) mas pode
  classificar um navegador bem obscuro como "Outro".

## 8. Testes realizados
- Sintaxe de todos os arquivos `.js` do backend e frontend (`node --check`),
  incluindo os 10 arquivos novos do Analytics (5 no backend, 5 no frontend).
- Balanceamento de tags nas páginas HTML novas/editadas, incluindo
  `admin/analytics.html`.
- Revisão manual do fluxo: login → cookie de sessão → rota admin bloqueada
  sem sessão (401) → produto criado no painel aparece no catálogo público
  (via `active=1`) → produto desativado some do catálogo sem ser excluído.
- Revisão manual do fluxo de Analytics: `analytics-track.js` gera
  visitor_id/session_id → `POST /api/track` valida payload (allowlist de
  eventos, rate limit por visitante, tamanho máximo de campos) → upsert de
  visitante/sessão + insert de evento dentro de uma transação (`db.tx`) →
  `analytics-queries.js` agrega por período com o filtro de data casando
  com os índices criados → `/admin/analytics/*` recusa acesso sem sessão
  (mesmo `requireAuth` das outras rotas `/admin`) → exportação CSV usa a
  mesma função de agregação da tela (sem duplicar lógica).
- Revisão de que nenhuma consulta usa concatenação de string do usuário em
  SQL (tudo via `?` → `$1..$n` parametrizado); o único ponto com nomes de
  coluna dinâmicos (`EXPORTERS` em `analytics.routes.js`) usa um mapa fixo
  no código, nunca uma coluna vinda da query string.
- **Ainda não testado em ambiente real** (Netlify + Supabase), porque este
  ambiente de sandbox não tem acesso de rede de saída (nem para `npm
  install` — as dependências declaradas em `package.json` não puderam ser
  baixadas para rodar os testes de integração). Antes de considerar pronto
  para produção:
  1. `netlify dev` (ou deploy em branch de preview) e repetir o teste do
     briefing item 41 (aba anônima → Home → catálogo → produto → WhatsApp
     → fechar → reabrir via Instagram/UTM → checar `/admin/analytics.html`).
  2. Confirmar que os cliques de WhatsApp aparecem em "Cliques no WhatsApp"
     e no produto certo.
  3. Deixar duas abas abertas simultaneamente e ver "🔴 Usuários agora"
     mudar sem recarregar a página manualmente.
  4. Testar em tela de celular real (não só DevTools) que os gráficos SVG
     não estouram a largura.
  5. Se habilitar `IPGEO_PROVIDER=ipapi`, confirmar que a consulta externa
     não atrasa perceptivelmente o carregamento do site (o timeout interno
     é de 1,5s e só roda 1x por sessão).

## 9. Configuração manual pendente
- Criar o bucket `crvl-images` no Supabase Storage (público).
- Preencher as 6 variáveis de ambiente no Netlify.
- Cadastrar os produtos reais pelo painel (`/admin/produtos.html`) — nenhum
  produto de exemplo foi inventado, o catálogo começa vazio.
- Opcional: revisar as 4 categorias semeadas (Tênis, Conjuntos, Camisetas,
  Calçados) e ajustar em `/admin/categorias.html` se os nomes não baterem
  com o que você vende.
- Opcional (Analytics): configurar `IPGEO_PROVIDER`/`IPGEO_API_KEY` se
  quiser o bloco de Localização preenchido (ver seção 7) — nada quebra sem
  isso, o painel só mostra o aviso de que a localização não está habilitada.
- Nenhuma variável de ambiente nova é **obrigatória** para o Analytics
  funcionar — ele já sai coletando dados reais assim que o deploy for feito.
