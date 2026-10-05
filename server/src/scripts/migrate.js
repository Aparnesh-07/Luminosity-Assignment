require('dotenv').config();
const { initDatabase } = require('../config/database');
const { ensureSeedAdmin } = require('../services/auth.service');

async function run() {
  console.log('🔄 Running MySQL schema migration...');
  try {
    await initDatabase();
    await ensureSeedAdmin();
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

run();
