require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

const PROJECT_REF = 'ceqfickdvljxldrywsst';

// Supabase offers two hosts — try the session pooler first, then direct
const HOSTS = [
  `aws-0-ap-south-1.pooler.supabase.com`,   // new pooler (port 5432, user postgres.ref)
  `db.${PROJECT_REF}.supabase.co`,           // legacy direct
];

async function tryConnect(host, user) {
  const client = new Client({
    host,
    port:     5432,
    user,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    ssl:      { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000
  });
  await client.connect();
  return client;
}

async function migrate() {
  let client = null;

  // Try pooler with prefixed user first, then legacy direct
  const attempts = [
    { host: `aws-0-ap-south-1.pooler.supabase.com`, user: `postgres.${PROJECT_REF}` },
    { host: `db.${PROJECT_REF}.supabase.co`,          user: `postgres` },
  ];

  for (const { host, user } of attempts) {
    try {
      console.log(`Trying: ${user}@${host} ...`);
      client = await tryConnect(host, user);
      console.log('✅ Connected!');
      break;
    } catch (e) {
      console.log(`  ✗ Failed: ${e.message}`);
    }
  }

  if (!client) {
    console.error('❌ Could not connect to Supabase PostgreSQL. Check DB_PASSWORD in .env');
    process.exit(1);
  }

  const sql = fs.readFileSync('./backend/migrate.sql', 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 4 && !s.startsWith('--'));

  let ok = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
      process.stdout.write('.');
    } catch (err) {
      fail++;
      process.stdout.write('x');
      if (!err.message.includes('already exists')) {
        console.error(`\n  ⚠  ${err.message.substring(0, 120)}`);
      }
    }
  }

  console.log(`\n\n✅ Migration done: ${ok} succeeded, ${fail} failed/skipped`);
  await client.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});

