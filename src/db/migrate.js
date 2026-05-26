import { getDb } from './client.js';

const db = getDb();

const tableStatements = [
  `create table if not exists users (
    id text primary key,
    name text not null,
    email text not null unique,
    password_hash text not null,
    password_salt text not null,
    role text not null check(role in ('admin', 'organisateur', 'client')),
    phone text default '',
    city text default 'Abidjan',
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists sessions (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    token_hash text not null unique,
    expires_at text not null,
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists events (
    id text primary key,
    organizer_id text not null references users(id),
    title text not null,
    category text not null,
    city text not null,
    location text default '',
    starts_at text not null,
    ends_at text not null,
    price_xof integer not null default 0,
    capacity integer not null default 0,
    tickets_sold integer not null default 0,
    status text not null default 'pending' check(status in ('pending', 'approved', 'rejected')),
    cover_url text default '/assets/img/event-default.svg',
    description text default '',
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists tickets (
    id text primary key,
    event_id text not null references events(id),
    user_id text not null references users(id),
    code text not null unique,
    quantity integer not null default 1,
    amount_xof integer not null default 0,
    status text not null default 'paid',
    payment_method text default 'Wave',
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists products (
    id text primary key,
    name text not null,
    category text not null,
    price_xof integer not null,
    stock integer not null default 0,
    image_url text default '/assets/img/product-default.svg',
    description text default '',
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists orders (
    id text primary key,
    user_id text not null references users(id),
    total_xof integer not null default 0,
    status text not null default 'pending',
    payment_method text default 'Orange Money',
    delivery_city text default '',
    delivery_address text default '',
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists order_items (
    id text primary key,
    order_id text not null references orders(id) on delete cascade,
    product_id text not null references products(id),
    quantity integer not null default 1,
    unit_price_xof integer not null default 0
  )`,
  `create table if not exists withdrawals (
    id text primary key,
    organizer_id text not null references users(id),
    amount_xof integer not null,
    status text not null default 'pending',
    created_at text not null default (datetime('now'))
  )`,
];

const indexStatements = [
  `create index if not exists idx_events_status on events(status)`,
  `create index if not exists idx_events_org on events(organizer_id)`,
  `create index if not exists idx_tickets_user on tickets(user_id)`,
  `create index if not exists idx_tickets_event on tickets(event_id)`
];

async function ensureColumn(table, column, definition) {
  const info = await db.execute(`pragma table_info(${table})`);
  const exists = info.rows.some((row) => row.name === column);
  if (!exists) {
    await db.execute(`alter table ${table} add column ${column} ${definition}`);
  }
}

for (const sql of tableStatements) {
  await db.execute(sql);
}

await ensureColumn('users', 'name', `text default ''`);
await ensureColumn('users', 'email', `text default ''`);
await ensureColumn('users', 'password_hash', `text default ''`);
await ensureColumn('users', 'password_salt', `text default ''`);
await ensureColumn('users', 'role', `text default 'client'`);
await ensureColumn('users', 'phone', `text default ''`);
await ensureColumn('users', 'city', `text default 'Abidjan'`);
await ensureColumn('users', 'created_at', `text default ''`);

await ensureColumn('events', 'organizer_id', `text default 'usr_orga_demo'`);
await ensureColumn('events', 'title', `text default ''`);
await ensureColumn('events', 'category', `text default 'Concert'`);
await ensureColumn('events', 'city', `text default 'Abidjan'`);
await ensureColumn('events', 'location', `text default ''`);
await ensureColumn('events', 'starts_at', `text default ''`);
await ensureColumn('events', 'ends_at', `text default ''`);
await ensureColumn('events', 'price_xof', `integer default 0`);
await ensureColumn('events', 'capacity', `integer default 0`);
await ensureColumn('events', 'tickets_sold', `integer default 0`);
await ensureColumn('events', 'status', `text default 'pending'`);
await ensureColumn('events', 'cover_url', `text default '/assets/img/event-default.svg'`);
await ensureColumn('events', 'description', `text default ''`);
await ensureColumn('events', 'created_at', `text default ''`);

await ensureColumn('tickets', 'event_id', `text default ''`);
await ensureColumn('tickets', 'user_id', `text default ''`);
await ensureColumn('tickets', 'code', `text default ''`);
await ensureColumn('tickets', 'quantity', `integer default 1`);
await ensureColumn('tickets', 'amount_xof', `integer default 0`);
await ensureColumn('tickets', 'status', `text default 'paid'`);
await ensureColumn('tickets', 'payment_method', `text default 'Wave'`);
await ensureColumn('tickets', 'created_at', `text default ''`);

await ensureColumn('products', 'name', `text default ''`);
await ensureColumn('products', 'category', `text default 'Lifestyle'`);
await ensureColumn('products', 'price_xof', `integer default 0`);
await ensureColumn('products', 'stock', `integer default 0`);
await ensureColumn('products', 'image_url', `text default '/assets/img/product-default.svg'`);
await ensureColumn('products', 'description', `text default ''`);
await ensureColumn('products', 'created_at', `text default ''`);

for (const sql of indexStatements) {
  await db.execute(sql);
}

console.log('Migrations appliquees.');
