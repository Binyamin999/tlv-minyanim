/**
 * The Postgres connection. Server-side only — nothing here may be imported
 * into a client component.
 *
 * No ORM, on purpose. The schema is already expressed completely in
 * `db/migrations/*.sql`, including CHECK constraints that encode the core
 * invariant. An ORM would fork that source of truth into a second, weaker
 * description of the same tables and the two would drift.
 *
 * This module deliberately has no imports of its own beyond `pg`, so that it
 * can be loaded identically by Next (bundler resolution, `@/db/client`) and by
 * the import script (nodenext, `../src/db/client.ts`).
 */
import { Pool, types } from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';

/**
 * `time` (OID 1083) comes back as a string from the driver. That string is a
 * clock face in Asia/Jerusalem, not a display value, and it is parsed into the
 * structured MinyanTime the moment it is read — see `src/db/queries.ts`. It is
 * never printed as it arrives.
 */
const OID_TIME = 1083;
types.setTypeParser(OID_TIME, (value) => value);

/**
 * bigint (OID 20) would otherwise arrive as a string. Our ids are identity
 * columns nowhere near 2^53, and a number is far easier to pass around.
 */
const OID_INT8 = 20;
types.setTypeParser(OID_INT8, (value) => Number.parseInt(value, 10));

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy it into .env.local (gitignored via .env*) — ' +
        'e.g. postgresql://<user>@localhost:5432/tlv_minyanim. Never hard-code it.',
    );
  }
  return url;
}

/**
 * One pool per process. Cached on globalThis because Next's dev server
 * re-evaluates modules on every edit, and a fresh pool per edit exhausts
 * Postgres' connection limit within a few saves.
 */
const POOL_KEY = Symbol.for('tlv-minyanim.pg-pool');

type PoolGlobal = typeof globalThis & { [POOL_KEY]?: Pool };

export function getPool(): Pool {
  const store = globalThis as PoolGlobal;
  const existing = store[POOL_KEY];
  if (existing) return existing;

  const pool = new Pool({
    connectionString: connectionString(),
    // Small: this app's pages issue one or two short queries each.
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  store[POOL_KEY] = pool;
  return pool;
}

/** A parameterised query. Values are always bound, never interpolated. */
export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  const result = await getPool().query<Row>(text, values as unknown[]);
  return result.rows;
}

/**
 * Run `fn` inside a transaction. Used by the importer: 16 synagogues either
 * all land or none do, so a failed run never leaves half a city in the table.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Scripts must close the pool or the process hangs. Pages must not call this. */
export async function closePool(): Promise<void> {
  const store = globalThis as PoolGlobal;
  const pool = store[POOL_KEY];
  if (!pool) return;
  delete store[POOL_KEY];
  await pool.end();
}
