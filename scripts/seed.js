const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const somethings = [{ name: 'Seed 1' }, { name: 'Seed 2' }];

async function seed() {
  console.log('Seeding data...');

  // Insert somethings (batch)
  if (somethings.length > 0) {
    const somethingPlaceholders = somethings.map((_, i) => `($${i + 1})`);
    const somethingValues = somethings.map((s) => s.name);
    await pool.query(
      `INSERT INTO "Something" ("name") VALUES ${somethingPlaceholders.join(', ')}`,
      somethingValues,
    );
  }
  console.log(`Inserted ${somethings.length} somethings.`);

  console.log('Seed data inserted successfully.');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end();
    process.exit(1);
  });
