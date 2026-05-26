import { createClient } from '@libsql/client';
import '../config/env.js';
import { requiredEnv } from '../config/env.js';

let db;

export function getDb() {
  if (!db) {
    db = createClient({
      url: requiredEnv('TURSO_DATABASE_URL'),
      authToken: requiredEnv('TURSO_AUTH_TOKEN')
    });
  }
  return db;
}

