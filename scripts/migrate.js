// migrate.js
// Forward-only, additive migrations for environments whose data must survive.
//
// scripts/reset.js applies schema.sql, which DROPs every table — correct for
// dev and CI, fatal in production. This runner instead applies the numbered
// files in migrations/ exactly once each, tracking what has run in a
// schema_migrations table.
//
// Every migration must be written to be safe on a database that already has
// the change (IF NOT EXISTS and friends), so a fresh database built from
// schema.sql and an older production database both end up in the same state.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'migrations');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT      PRIMARY KEY,
      applied_on TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function readApplied() {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((row) => row.filename));
}

function readMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) return [];

  return (
    fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      // Numeric prefixes mean a plain lexical sort gives the intended order.
      .sort()
  );
}

async function applyMigration(filename) {
  const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
  const client = await pool.connect();

  try {
    // Each migration runs in its own transaction, so a failure half way
    // through leaves the database untouched rather than partly migrated.
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`  applied ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    // cause preserves the original Postgres error for anyone debugging a
    // failed deploy; the message alone loses the error code and position.
    throw new Error(`Migration ${filename} failed: ${error.message}`, { cause: error });
  } finally {
    client.release();
  }
}

async function migrate() {
  console.log('Running migrations...');

  await ensureMigrationsTable();

  const applied = await readApplied();
  const files = readMigrationFiles();
  const pending = files.filter((name) => !applied.has(name));

  if (pending.length === 0) {
    console.log(`  nothing to apply (${files.length} already up to date)`);
    await pool.end();
    return;
  }

  for (const filename of pending) {
    await applyMigration(filename);
  }

  console.log(`Migrations complete: ${pending.length} applied.`);
  await pool.end();
}

migrate().catch((error) => {
  console.error('Migration failed:', error.message);
  pool.end();
  process.exit(1);
});
