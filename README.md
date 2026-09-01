# CRVL Store — Site + Catálogo + Painel Administrativo

Site institucional (HTML/CSS/JS puro, preservado como estava) + catálogo de
produtos e painel admin novos, rodando em Netlify Functions (Express) com
banco Postgres via Supabase.

## Estrutura
```
crvl-store/
├── public/                    ← pasta publicada pelo Netlify
│   ├── index.html              (existente — só 4 pequenas edições)
│   ├── catalogo.html           (novo — catálogo público)
│   ├── produto.html            (novo — página de detalhe do produto)
│   ├── assets/                 (existente, intocado)
│   ├── css/catalogo.css        (novo — componentes do catálogo/admin)
│   ├── js/
│   │   ├── api.js              (novo — wrapper fetch)
│   │   ├── catalogo.js         (novo)
│   │   ├── produto.js          (novo)
│   │   ├── admin-common.js     (novo — guard/logout/toast)
│   │   ├── admin-produtos.js   (novo)
│   │   └── admin-categorias.js (novo)
│   └── admin/
│       ├── login.html          (novo)
│       ├── index.html          (novo — dashboard)
│       ├── produtos.html       (novo — CRUD de produtos)
│       └── categorias.html     (novo — CRUD de categorias)
├── netlify/functions/          ← backend novo (Netlify Functions)
│   ├── api.js                  (entrypoint Express)
│   ├── lib/ (db, auth, upload, rate-limit, http-utils)
│   └── routes/ (auth, products, categories, uploads, dashboard)
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
| `NODE_ENV` | `production` |

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
`products`, `settings`, `logs`, `rate_hits`.

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

## 7. Testes realizados
- Sintaxe de todos os arquivos `.js` do backend e frontend (`node --check`).
- Balanceamento de tags nas 7 páginas HTML novas.
- Revisão manual do fluxo: login → cookie de sessão → rota admin bloqueada
  sem sessão (401) → produto criado no painel aparece no catálogo público
  (via `active=1`) → produto desativado some do catálogo sem ser excluído.
- **Ainda não testado em ambiente real** (Netlify + Supabase), porque este
  ambiente de sandbox não tem acesso de rede de saída. Antes de considerar
  pronto para produção, rode localmente com `netlify dev` (ou faça deploy em
  um branch de preview) e percorra a lista de testes do seu briefing original
  (login incorreto, acesso direto a `/admin` sem sessão, upload de imagem,
  filtros combinados, mobile).

## 8. Configuração manual pendente
- Criar o bucket `crvl-images` no Supabase Storage (público).
- Preencher as 6 variáveis de ambiente no Netlify.
- Cadastrar os produtos reais pelo painel (`/admin/produtos.html`) — nenhum
  produto de exemplo foi inventado, o catálogo começa vazio.
- Opcional: revisar as 4 categorias semeadas (Tênis, Conjuntos, Camisetas,
  Calçados) e ajustar em `/admin/categorias.html` se os nomes não baterem
  com o que você vende.
