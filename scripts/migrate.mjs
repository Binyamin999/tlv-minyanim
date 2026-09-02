#!/usr/bin/env node
/**
 * Apply every migration that has not been applied yet.
 *
 * Until now the eleven files in db/migrations were run by hand with psql, in
 * order, from memory. That works exactly once — on a database somebody has
 * been watching. Pointing this at a fresh host is a different job: it has to
 * know which files have run, and it has to refuse to guess.
 *
 * Each file is executed EXACTLY AS WRITTEN, not wrapped in a transaction of
 * this script's own. Several of them open their own BEGIN/COMMIT, and 0010
 * opens two because `ALTER TYPE ... ADD VALUE` cannot share a transaction with
 * the statements that use the new value. Wrapping them would nest, and
 * Postgres does not nest. The consequence is honest rather than hidden: a file
 * that fails part-way leaves what its own transactions committed, and is not
 * recorded as applied, so the next run retries it. Every file here is written
 * to survive that — `IF NOT EXISTS`, and one concern per file.
 *
 *   DATABASE_URL=postgres://… node scripts/migrate.mjs
 *   DATABASE_URL=…            node scripts/migrate.mjs --dry-run
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DIR = join(fileURLToPath(new URL('..', import.meta.url)), 'db/migrations');
const dryRun = process.argv.includes('--dry-run');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Point it at the database to migrate.');
  process.exit(1);
}

// A managed host almost always requires TLS; a local socket has none to offer.
const isRemote = /^postgres(ql)?:\/\/[^/]*[a-z]/i.test(url) && !/localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({
  connectionString: url,
  ...(isRemote ? { ssl: { rejectUnauthorized: true } } : {}),
});
await client.connect();

const where = await client.query('SELECT current_database() AS db, version() AS v');
console.log(`database: ${where.rows[0].db}`);
console.log(`server:   ${where.rows[0].v.split(',')[0]}`);

// PostGIS is not optional — `synagogues.location` is a geography column and
// every distance query goes through it. Say so plainly rather than failing
// forty lines into 0001 with a syntax error about an unknown type.
const gis = await client.query(
  "SELECT count(*)::int AS n FROM pg_available_extensions WHERE name = 'postgis'",
);
if (gis.rows[0].n === 0) {
  console.error(
    '\nThis server does not offer PostGIS, and the schema cannot be created without it.\n' +
      'Pick a host that provides it — Neon, Supabase and Vercel Postgres all do.',
  );
  process.exit(1);
}

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const applied = new Set(
  (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
);
const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`  skip  ${file}`);
    continue;
  }
  if (dryRun) {
    console.log(`  would run  ${file}`);
    ran++;
    continue;
  }
  process.stdout.write(`  apply ${file} … `);
  const sql = await readFile(join(DIR, file), 'utf8');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log('ok');
    ran++;
  } catch (error) {
    console.log('FAILED');
    console.error(`\n${file}: ${error.message}`);
    console.error('Nothing was recorded for this file; fix it and run again.');
    await client.end();
    process.exit(1);
  }
}

console.log(
  ran === 0
    ? '\nnothing to do — the schema is up to date'
    : `\n${dryRun ? 'would apply' : 'applied'} ${ran} migration(s)`,
);
await client.end();
