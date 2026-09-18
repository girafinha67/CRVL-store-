'use strict';

const { Pool } = require('pg');
const crypto = require('node:crypto');

const databaseUrl = process.env.SUPABASE_DB_POOLER_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('[crvl] SUPABASE_DB_POOLER_URL não definida — configure a connection string do Supabase nas env vars do Netlify.');
}

// max: em ambiente serverless (Netlify Functions) cada container "quente"
// mantém seu próprio Pool, e vários containers podem rodar em paralelo sob
// carga. O pooler do Supabase (PgBouncer) em modo "session" tem um limite
// baixo de clientes simultâneos (ex.: pool_size: 15 no plano free) — se cada
// container abrir muitas conexões, o total estoura esse limite e o Supabase
// devolve "(EMAXCONNSESSION) max clients reached in session mode". Por isso
// mantemos max baixo por container e liberamos conexões ociosas rápido.
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl && databaseUrl.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // Erros em clients ociosos (ex.: conexão derrubada pelo pooler) não devem
  // derrubar o processo da function — só logamos.
  console.error('[crvl] Erro inesperado no pool do Postgres:', err.message);
});

// Converte placeholders estilo "?" para o formato do Postgres ($1, $2...)
function toPgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function all(sql, params = []) {
  const { rows } = await pool.query(toPgQuery(sql), params);
  return rows;
}

async function get(sql, params = []) {
  const { rows } = await pool.query(toPgQuery(sql), params);
  return rows[0] || null;
}

function addInsertReturningId(sql) {
  const isInsert = /^\s*INSERT/i.test(sql);
  const isSettingsInsert = /^\s*INSERT\s+INTO\s+settings\b/i.test(sql);
  return isInsert && !isSettingsInsert && !/RETURNING/i.test(sql) ? `${sql} RETURNING id` : sql;
}

async function run(sql, params = []) {
  const q = addInsertReturningId(toPgQuery(sql));
  const res = await pool.query(q, params);
  return {
    lastInsertRowid: res.rows[0] ? res.rows[0].id : undefined,
    changes: res.rowCount,
  };
}

async function exec(sql) {
  await pool.query(sql);
}

// Transação simples: fn recebe { get, all, run } ligados a um client dedicado.
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scoped = {
      get: async (sql, params = []) => (await client.query(toPgQuery(sql), params)).rows[0] || null,
      all: async (sql, params = []) => (await client.query(toPgQuery(sql), params)).rows,
      run: async (sql, params = []) => {
        const q = addInsertReturningId(toPgQuery(sql));
        const res = await client.query(q, params);
        return { lastInsertRowid: res.rows[0] ? res.rows[0].id : undefined, changes: res.rowCount };
      },
    };
    const result = await fn(scoped);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Schema + seed (idempotente, roda uma vez por container "quente") ----------
let initPromise = null;

async function ensureSchema() {
  await exec(`
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessão = também é o "dispositivo confiável": quando remember=1, dura 30 dias
-- e o navegador não precisa logar de novo. Revogar = apagar a linha (logout
-- "deste dispositivo" ou botão de revogar no painel).
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  remember INTEGER NOT NULL DEFAULT 0,
  device_label TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ip TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  image TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT NOT NULL DEFAULT '',
  sku TEXT,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  promo_price REAL,
  sizes TEXT NOT NULL DEFAULT '[]',
  colors TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  stock INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registro de tentativas para rate limiting (login), persistido para
-- sobreviver a cold starts (diferente de um Map em memória).
CREATE TABLE IF NOT EXISTS rate_hits (
  id SERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== Analytics (visitantes/sessões/eventos) =====================
-- Visitante anônimo: um UUID gerado e guardado no localStorage do navegador
-- (nunca dado pessoal). Serve só para diferenciar "novo" de "recorrente".
CREATE TABLE IF NOT EXISTS analytics_visitors (
  id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sessions_count INTEGER NOT NULL DEFAULT 0
);

-- Sessão: UUID gerado no sessionStorage do navegador (expira sozinho ao
-- fechar a aba ou após 30min de inatividade — ver public/js/analytics-track.js).
-- Guarda o "resumo" da sessão; os eventos individuais ficam em analytics_events.
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL REFERENCES analytics_visitors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_new_visitor INTEGER NOT NULL DEFAULT 0,
  entry_page TEXT,
  last_page TEXT,
  referrer TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  term TEXT,
  content TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  country TEXT,
  region TEXT,
  city TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0
);

-- Evento individual (page_view, product_view, whatsapp_click, search, etc).
-- Câmera lenta de tudo que acontece no site — as telas de Analytics leem
-- daqui via consultas agregadas (nunca varrendo a tabela inteira sem filtro
-- de data, ver lib/analytics-queries.js).
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  page_url TEXT,
  page_path TEXT,
  referrer TEXT,
  product_id INTEGER,
  product_slug TEXT,
  category_slugs TEXT NOT NULL DEFAULT '[]',
  search_term TEXT,
  search_results INTEGER,
  meta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
  `);

  // Categorias fixas (multi-seleção) do produto — ver lib/category-tags.js.
  // Coluna separada de category_id/categories (sistema antigo, mantido por
  // compatibilidade mas não usado mais no formulário de produto).
  await exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_tags TEXT NOT NULL DEFAULT '[]';`);

  await exec(`
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active_order ON categories(active, order_index);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_hits_lookup ON rate_hits(bucket, ip, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last_seen ON analytics_visitors(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_activity ON analytics_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON analytics_events(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_product ON analytics_events(product_id, created_at DESC) WHERE product_id IS NOT NULL;
  `);
}

async function seed() {
  const catCount = (await get('SELECT COUNT(*) AS n FROM categories')).n;
  if (Number(catCount) === 0) {
    const insertCat = 'INSERT INTO categories (name, slug, order_index, active) VALUES (?, ?, ?, 1)';
    await run(insertCat, ['Tênis', 'tenis', 1]);
    await run(insertCat, ['Conjuntos', 'conjuntos', 2]);
    await run(insertCat, ['Camisetas', 'camisetas', 3]);
    await run(insertCat, ['Calçados', 'calcados', 4]);
  }
}

function verifyPasswordScrypt(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Garante que existe exatamente um administrador com as credenciais definidas
// em ADMIN_EMAIL / ADMIN_PASSWORD (variáveis de ambiente do Netlify). Nunca
// grava senha em texto puro — só hash scrypt + salt.
async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      '[crvl] ADMIN_EMAIL/ADMIN_PASSWORD não definidos — configure-os nas ' +
      'variáveis de ambiente do Netlify para criar/atualizar o administrador.'
    );
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await get('SELECT * FROM admins ORDER BY id ASC LIMIT 1');

  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    await run('INSERT INTO admins (email, password_hash, salt) VALUES (?, ?, ?)', [
      normalizedEmail,
      hash,
      salt,
    ]);
    console.log(`[crvl] Administrador inicial criado: ${normalizedEmail}`);
    return;
  }

  const emailMatches = existing.email === normalizedEmail;
  const passwordMatches = verifyPasswordScrypt(password, existing.salt, existing.password_hash);
  if (emailMatches && passwordMatches) return;

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  await run('UPDATE admins SET email = ?, password_hash = ?, salt = ? WHERE id = ?', [
    normalizedEmail,
    hash,
    salt,
    existing.id,
  ]);
  console.log(`[crvl] Administrador atualizado para: ${normalizedEmail}`);
}

// Retenção do Analytics: por padrão guarda ~13 meses (permite comparar
// "este mês vs mesmo mês ano passado"). Ajustável via env var sem precisar
// alterar código. Ver README.md, seção de Analytics.
const ANALYTICS_RETENTION_DAYS = Math.max(
  30,
  parseInt(process.env.ANALYTICS_RETENTION_DAYS, 10) || 400
);

async function pruneOldData() {
  try {
    await exec("DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '1 day'");
    await exec("DELETE FROM rate_hits WHERE created_at < NOW() - INTERVAL '1 day'");
    // Eventos/sessões/visitantes de Analytics mais antigos que a retenção
    // configurada. Eventos referenciam sessões com ON DELETE CASCADE, então
    // apagar a sessão já leva os eventos junto; visitantes só são removidos
    // quando não sobra nenhuma sessão recente (evita perder o "primeiro
    // acesso" de alguém que voltou a visitar recentemente).
    await exec(
      `DELETE FROM analytics_sessions WHERE started_at < NOW() - INTERVAL '${ANALYTICS_RETENTION_DAYS} days'`
    );
    await exec(
      `DELETE FROM analytics_visitors WHERE last_seen_at < NOW() - INTERVAL '${ANALYTICS_RETENTION_DAYS} days'`
    );
  } catch (err) {
    console.warn('[crvl] Falha ao limpar dados antigos (não crítico):', err.message);
  }
}

// ---------- settings (key/value genérico — usado pelo toggle de Analytics) ----------
async function getSetting(key, fallback = null) {
  const row = await get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

async function setSetting(key, value) {
  await run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, String(value)]
  );
}

function init() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureSchema();
      await seed();
      await ensureAdmin();
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

module.exports = { pool, all, get, run, exec, tx, init, pruneOldData, getSetting, setSetting, ANALYTICS_RETENTION_DAYS };
