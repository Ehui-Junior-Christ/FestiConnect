import { createClient } from '@libsql/client';
import { databaseConfig } from '../config/env.js';

let db;

export function getDb() {
  if (!db) {
    db = createClient(databaseConfig());
  }
  return db;
}
