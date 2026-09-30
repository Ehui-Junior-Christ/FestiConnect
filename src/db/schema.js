// Acces "dynamique" au schema (compatibilite avec l'ancien schema camelCase).
// Tous les noms de tables/colonnes interpoles dans du SQL passent par une
// whitelist (tables) ou une validation stricte d'identifiant (colonnes).

export const ALLOWED_TABLES = Object.freeze(new Set([
  'users',
  'sessions',
  'events',
  'tickets',
  'products',
  'orders',
  'order_items',
  'withdrawals',
  'notifications',
  'ticket_categories',
  'promo_codes',
  'favorites'
]));

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function assertTable(table) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table non autorisee: ${String(table).slice(0, 40)}`);
  return table;
}

export function assertIdentifier(name) {
  if (typeof name !== 'string' || !IDENTIFIER.test(name)) {
    throw new Error(`Identifiant SQL invalide: ${String(name).slice(0, 40)}`);
  }
  return name;
}

const cache = new Map();

export function clearSchemaCache() {
  cache.clear();
}

export async function columnInfo(db, table) {
  assertTable(table);
  if (!cache.has(table)) {
    const info = await db.execute(`pragma table_info(${table})`);
    const columns = new Map();
    for (const row of info.rows) {
      if (IDENTIFIER.test(String(row.name))) columns.set(String(row.name), row);
    }
    cache.set(table, columns);
  }
  return cache.get(table);
}

export async function tableColumns(db, table) {
  return new Set((await columnInfo(db, table)).keys());
}

// Construit un INSERT parametre en ne gardant que les colonnes existantes.
export async function buildInsert(db, table, record) {
  const columns = await columnInfo(db, table);
  const entries = Object.entries(record).filter(([key, value]) => {
    const column = columns.get(key);
    if (!column || value === undefined) return false;
    if (key === 'id' && String(column.type).toUpperCase().includes('INT') && typeof value === 'string') return false;
    return true;
  });
  if (!entries.length) throw new Error(`Aucune colonne a inserer dans ${table}`);
  const names = entries.map(([key]) => assertIdentifier(key));
  return {
    sql: `insert into ${assertTable(table)} (${names.join(', ')}) values (${names.map(() => '?').join(', ')})`,
    args: entries.map(([, value]) => value)
  };
}

export async function insertByExistingColumns(db, table, record) {
  return db.execute(await buildInsert(db, table, record));
}
