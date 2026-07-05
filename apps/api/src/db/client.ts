import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

let db: ReturnType<typeof createDb> | null = null;

function createDb() {
  // prepare:false is required for Supabase's transaction-mode pooler (pgbouncer).
  const client = postgres(env().DATABASE_URL, { prepare: false, max: 10 });
  return drizzle(client, { schema });
}

export function getDb() {
  if (!db) db = createDb();
  return db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
