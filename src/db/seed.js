import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { getDb } from './client.js';
import { assertIdentifier, assertTable } from './schema.js';
import { hashPassword, passwordPolicyError } from '../shared/passwords.js';

// En production, le seed de demonstration est refuse par defaut : il cree des
// comptes (dont un admin) aux mots de passe publics. Pour l'autoriser il faut
// SEED_ALLOW_PRODUCTION=true ET des mots de passe fournis par l'environnement.
function demoPassword(envName, fallback) {
  const provided = process.env[envName];
  if (config.isProduction) {
    if (process.env.SEED_ALLOW_PRODUCTION !== 'true') {
      throw new Error('Seed de demonstration refuse en production (SEED_ALLOW_PRODUCTION=true requis).');
    }
    if (!provided) throw new Error(`${envName} est obligatoire pour seeder en production.`);
  }
  const password = provided || fallback;
  const policyError = passwordPolicyError(password);
  if (policyError) throw new Error(`${envName}: ${policyError}`);
  return password;
}

const demoPasswords = {
  admin: demoPassword('SEED_ADMIN_PASSWORD', 'Admin123!'),
  organizer: demoPassword('SEED_ORGANIZER_PASSWORD', 'Orga123!'),
  client: demoPassword('SEED_CLIENT_PASSWORD', 'Client123!')
};

const db = getDb();

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
}

async function tableColumns(table) {
  assertTable(table);
  const info = await db.execute(`pragma table_info(${table})`);
  return new Set(info.rows.map((row) => row.name));
}

async function insertOrUpdateById(table, record) {
  const columns = await tableColumns(table);
  const entries = Object.entries(record).filter(([key]) => columns.has(key) && assertIdentifier(key));
  const updateColumns = entries
    .map(([key]) => key)
    .filter((key) => key !== 'id')
    .map((key) => `${key} = excluded.${key}`)
    .join(', ');
  await db.execute({
    sql: `insert into ${table} (${entries.map(([key]) => key).join(', ')})
          values (${entries.map(() => '?').join(', ')})
          on conflict(id) do update set ${updateColumns}`,
    args: entries.map(([, value]) => value)
  });
}

async function upsertUser(user) {
  const password = await hashPassword(user.password);
  const columns = await tableColumns('users');
  const record = {
    id: user.id,
    name: user.name,
    email: user.email,
    password_hash: password.hash,
    password_salt: password.salt,
    role: user.role,
    phone: user.phone,
    city: user.city,
    balance: 0,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  if (columns.has('password')) record.password = password.hash;
  const entries = Object.entries(record).filter(([key]) => columns.has(key) && assertIdentifier(key));
  const existing = await db.execute({ sql: 'select id from users where email = ?', args: [user.email] });
  if (existing.rows[0]) {
    const updateEntries = entries.filter(([key]) => key !== 'id' && key !== 'email');
    await db.execute({
      sql: `update users set ${updateEntries.map(([key]) => `${key} = ?`).join(', ')} where email = ?`,
      args: [...updateEntries.map(([, value]) => value), user.email]
    });
    return;
  }
  await db.execute({
    sql: `insert into users (${entries.map(([key]) => key).join(', ')}) values (${entries.map(() => '?').join(', ')})`,
    args: entries.map(([, value]) => value)
  });
}

const admin = { id: 'usr_admin_demo', name: 'Aminata Kouassi', email: 'admin@festiconnect.ci', password: demoPasswords.admin, role: 'admin', phone: '+225 07 00 00 00 01', city: 'Abidjan' };
const organizer = { id: 'usr_orga_demo', name: 'Collectif Nouchi Live', email: 'organisateur@festiconnect.ci', password: demoPasswords.organizer, role: 'organisateur', phone: '+225 05 00 00 00 02', city: 'Abidjan' };
const client = { id: 'usr_client_demo', name: 'Junior Ehui', email: 'client@festiconnect.ci', password: demoPasswords.client, role: 'client', phone: '+225 01 00 00 00 03', city: 'Yamoussoukro' };

await upsertUser(admin);
await upsertUser(organizer);
await upsertUser(client);

const events = [
  ['evt_abissa_2026', 'Festival Abissa Experience', 'Tradition', 'Grand-Bassam', 'Place Abissa', '2026-08-14T18:00', '2026-08-15T02:00', 15000, 1200, 384, 'approved', '/assets/img/event-abissa.svg', 'Une celebration immersive du patrimoine Nzima avec concerts, defiles et gastronomie locale.'],
  ['evt_maquis_night', 'Maquis Electronic Night', 'Concert', 'Abidjan', 'Sofitel Ivoire', '2026-06-21T20:00', '2026-06-22T03:00', 25000, 900, 621, 'approved', '/assets/img/event-maquis.svg', 'La rencontre des DJs afro-electro, des createurs visuels et des marques culturelles urbaines.'],
  ['evt_mode_sahel', 'Salon Mode Sahel', 'Mode', 'Bouake', 'Palais de la Culture', '2026-07-05T10:00', '2026-07-05T20:00', 8000, 600, 147, 'approved', '/assets/img/event-mode.svg', 'Defiles, pop-up stores et panels autour des textiles africains contemporains.'],
  ['evt_pending_yakro', 'Nuit Mandingue Premium', 'Concert', 'Yamoussoukro', 'Fondation FHB', '2026-09-12T19:30', '2026-09-13T01:00', 18000, 700, 0, 'pending', '/assets/img/event-default.svg', 'Projet soumis a validation administrative.']
];

for (const event of events) {
  const [eventId, title, category, city, location, startsAt, endsAt, price, capacity, sold, status, cover, description] = event;
  await insertOrUpdateById('events', {
    id: eventId,
    organizer_id: organizer.id,
    organizerId: organizer.id,
    title,
    category,
    city,
    location,
    starts_at: startsAt,
    ends_at: endsAt,
    date: startsAt,
    price_xof: price,
    price,
    capacity,
    ticketsCapacity: capacity,
    tickets_sold: sold,
    ticketsSold: sold,
    status,
    cover_url: cover,
    image: cover,
    description,
    created_at: new Date().toISOString()
  });
}

const products = [
  ['prd_kente_cap', 'Casquette Kente Edition', 'Accessoire', 12000, 80, '/assets/img/product-cap.svg', 'Casquette brodee en serie limitee, inspiree des motifs Akan.'],
  ['prd_baule_tote', 'Tote Bag Baoule', 'Lifestyle', 9000, 120, '/assets/img/product-tote.svg', 'Sac epais imprime localement, ideal pour festivals et marches creatifs.'],
  ['prd_affiche_abissa', 'Affiche Collector Abissa', 'Art', 15000, 40, '/assets/img/product-poster.svg', 'Tirage numerote sur papier mat premium.']
];

for (const product of products) {
  const [productId, name, category, price, stock, image, description] = product;
  await insertOrUpdateById('products', {
    id: productId,
    name,
    title: name,
    category,
    price_xof: price,
    price,
    stock,
    image_url: image,
    image,
    description,
    created_at: new Date().toISOString()
  });
}

await insertOrUpdateById('tickets', {
  id: 'tkt_demo_client',
  event_id: 'evt_abissa_2026',
  eventId: 'evt_abissa_2026',
  eventTitle: 'Festival Abissa Experience',
  eventDate: '2026-08-14T18:00',
  eventLocation: 'Place Abissa',
  eventImage: '/assets/img/event-abissa.svg',
  user_id: client.id,
  userId: client.id,
  code: 'FC-DEMO-2026',
  qrcode: 'FC-DEMO-2026',
  quantity: 2,
  amount_xof: 30000,
  price: 30000,
  status: 'paid',
  payment_method: 'Wave',
  created_at: new Date().toISOString(),
  createdAt: new Date().toISOString()
});

console.log('Donnees de demonstration inserees.');
