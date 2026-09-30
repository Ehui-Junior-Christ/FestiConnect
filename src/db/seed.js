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
      throw new Error('Seed de démonstration refusé en production (SEED_ALLOW_PRODUCTION=true requis).');
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

// Dates relatives au jour du seed, en heure d'Abidjan (UTC) : les evenements de
// demonstration restent toujours a venir (sauf un evenement passe, pour les avis).
const DAY_MS = 24 * 60 * 60 * 1000;
function at(days, time) {
  return `${new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10)}T${time}`;
}
function ago(days, hours = 0) {
  return new Date(Date.now() - days * DAY_MS - hours * 60 * 60 * 1000).toISOString();
}

const events = [
  ['evt_maquis_night', 'Maquis Electronic Night', 'Concert', 'Abidjan', 'Sofitel Hôtel Ivoire, Cocody', at(1, '21:00'), at(2, '03:00'), 25000, 900, 621, 'approved', '/assets/img/event-maquis.svg', 'La rencontre des DJ afro-électro, des créateurs visuels et des marques culturelles urbaines. Ouverture des portes à 20h30, dress code chic décontracté.'],
  ['evt_mode_sahel', 'Salon Mode Sahel', 'Mode', 'Bouaké', 'Palais de la Culture', at(16, '10:00'), at(16, '20:00'), 8000, 600, 147, 'approved', '/assets/img/event-mode.svg', 'Défilés, pop-up stores et tables rondes autour des textiles africains contemporains : pagne tissé baoulé, bogolan, indigo.'],
  ['evt_abissa_2026', 'Festival Abissa Experience', 'Tradition', 'Grand-Bassam', 'Place Abissa, quartier France', at(24, '18:00'), at(25, '02:00'), 15000, 1200, 384, 'approved', '/assets/img/event-abissa.svg', 'Une célébration du patrimoine N\'zima avec concerts, défilés en tenue traditionnelle et gastronomie locale au bord de la lagune.'],
  ['evt_pending_yakro', 'Nuit Mandingue Premium', 'Concert', 'Yamoussoukro', 'Fondation Félix Houphouët-Boigny', at(40, '19:30'), at(41, '01:00'), 18000, 700, 0, 'pending', '/assets/img/event-default.svg', 'Kora, balafon et griots invités pour une soirée mandingue. Projet soumis à validation.'],
  ['evt_zouglou_past', 'Nuit du Zouglou', 'Concert', 'Abidjan', 'Palais de la Culture, Treichville', at(-10, '20:00'), at(-9, '02:00'), 5000, 800, 2, 'approved', '/assets/img/event-default.svg', 'Les groupes de la nouvelle scène zouglou sur une même scène, avec animation ambiance facile entre les passages.']
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
    created_at: ago(30)
  });
}

// Categories de billets (Salon Mode Sahel garde volontairement son tarif unique).
const ticketCategories = [
  ['cat_abissa_early', 'evt_abissa_2026', 'Early bird', 7500, 200, 200],
  ['cat_abissa_std', 'evt_abissa_2026', 'Standard', 15000, 800, 150],
  ['cat_abissa_vip', 'evt_abissa_2026', 'VIP', 35000, 200, 34],
  ['cat_maquis_std', 'evt_maquis_night', 'Standard', 25000, 700, 540],
  ['cat_maquis_vip', 'evt_maquis_night', 'VIP carré', 50000, 200, 81]
];
for (const [position, [categoryId, eventId, name, price, capacity, sold]] of ticketCategories.entries()) {
  await insertOrUpdateById('ticket_categories', { id: categoryId, event_id: eventId, name, price_xof: price, capacity, sold, position, created_at: ago(30) });
}
// Jauge, prix d'appel et ventes de l'evenement = agregats de ses categories.
for (const eventId of new Set(ticketCategories.map(([, eventId]) => eventId))) {
  await db.execute({
    sql: `update events set
            capacity = (select sum(capacity) from ticket_categories where event_id = ?),
            price_xof = (select min(price_xof) from ticket_categories where event_id = ?),
            tickets_sold = (select sum(sold) from ticket_categories where event_id = ?)
          where id = ?`,
    args: [eventId, eventId, eventId, eventId]
  });
}

// Codes promo : un actif en pourcentage, un en montant fixe, un expire.
const promoCodes = [
  ['prm_demo_bassam10', 'evt_abissa_2026', 'BASSAM10', 'percent', 10, 100, 12, at(20, '23:59')],
  ['prm_demo_maquis2000', 'evt_maquis_night', 'MAQUIS2000', 'fixed', 2000, 50, 7, ''],
  ['prm_demo_zouglou', 'evt_zouglou_past', 'ZOUGLOU500', 'fixed', 500, 0, 3, at(-12, '23:59')]
];
for (const [promoId, eventId, code, kind, value, maxUses, used, expiresAt] of promoCodes) {
  await insertOrUpdateById('promo_codes', {
    id: promoId, event_id: eventId, organizer_id: organizer.id, code, kind, value, max_uses: maxUses, used, expires_at: expiresAt, active: 1, created_at: ago(25)
  });
}

const products = [
  ['prd_kente_cap', 'Casquette Kente Édition', 'Accessoire', 12000, 80, '/assets/img/product-cap.svg', 'Casquette brodée en série limitée, inspirée des motifs akan.'],
  ['prd_baule_tote', 'Tote bag Baoulé', 'Lifestyle', 9000, 120, '/assets/img/product-tote.svg', 'Sac épais imprimé à Abidjan, idéal pour les festivals et les marchés créatifs.'],
  ['prd_affiche_abissa', 'Affiche collector Abissa', 'Art', 15000, 40, '/assets/img/product-poster.svg', 'Tirage numéroté sur papier mat 250 g.']
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

async function seedTicket(ticket) {
  const event = events.find(([eventId]) => eventId === ticket.event_id);
  await insertOrUpdateById('tickets', {
    ...ticket,
    eventId: ticket.event_id,
    eventTitle: event[1],
    eventDate: event[5],
    eventLocation: event[4],
    eventImage: event[11],
    userId: ticket.user_id,
    qrcode: ticket.code,
    price: ticket.amount_xof,
    status: ticket.status || 'paid',
    createdAt: ticket.created_at
  });
}

// Billets du client de demonstration : un evenement a venir, un evenement
// demain (rappel J-1) et un evenement passe (avis).
await seedTicket({ id: 'tkt_demo_client', event_id: 'evt_abissa_2026', category_id: 'cat_abissa_std', category_name: 'Standard', user_id: client.id, code: 'FC-DEMO-2026', quantity: 2, amount_xof: 30000, payment_method: 'Wave', created_at: ago(6) });
await seedTicket({ id: 'tkt_demo_maquis', event_id: 'evt_maquis_night', category_id: 'cat_maquis_std', category_name: 'Standard', user_id: client.id, code: 'FC-DEMO-MAQUIS', quantity: 1, amount_xof: 25000, payment_method: 'Orange Money', created_at: ago(3) });
await seedTicket({ id: 'tkt_demo_zouglou', event_id: 'evt_zouglou_past', user_id: client.id, code: 'FC-DEMO-ZOUGLOU', quantity: 2, amount_xof: 10000, payment_method: 'Moov Money', created_at: ago(15), checked_in_at: ago(10, -20), checked_in_by: organizer.id });

// Favoris du client de demonstration.
for (const [favoriteId, eventId] of [['fav_demo_mode', 'evt_mode_sahel'], ['fav_demo_abissa', 'evt_abissa_2026']]) {
  await db.execute({
    sql: 'insert or ignore into favorites (id, user_id, event_id, created_at) values (?, ?, ?, ?)',
    args: [favoriteId, client.id, eventId, ago(4)]
  });
}

// Notifications de demonstration (le rappel J-1 du client est calcule a la lecture).
await insertOrUpdateById('notifications', {
  id: 'ntf_demo_abissa_ok',
  user_id: organizer.id,
  type: 'event_status',
  title: '« Festival Abissa Experience » est en ligne',
  body: 'Ton événement est visible dans le catalogue et la billetterie est ouverte.',
  link: '/evenement.html?id=evt_abissa_2026',
  read_at: null,
  created_at: ago(20)
});

console.log('Données de démonstration insérées.');
