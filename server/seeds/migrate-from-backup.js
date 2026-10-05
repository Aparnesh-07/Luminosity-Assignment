const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initDatabase, query } = require('../src/config/database');
const { ensureSeedAdmin } = require('../src/services/auth.service');
const { importStudioBackup } = require('../src/services/backup.service');

async function seedFromBackup() {
  try {
    await initDatabase();
    await ensureSeedAdmin();

    // Default backup file path
    const backupFilePath =
      process.argv[2] ||
      path.join(__dirname, '../../backups/studio-backup-2026-08-29.json');

    if (!fs.existsSync(backupFilePath)) {
      console.error(`❌ Backup file not found at: ${backupFilePath}`);
      process.exit(1);
    }

    console.log(`📖 Reading backup from: ${backupFilePath}`);
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

    // Fetch the primary studio ID
    const [studios] = await query('SELECT id FROM studios ORDER BY id ASC LIMIT 1');
    if (!studios || studios.length === 0) {
      console.error('❌ No studio found in database.');
      process.exit(1);
    }

    const studioId = studios[0].id;
    console.log(`📥 Importing backup into Studio ID: ${studioId}...`);

    const result = await importStudioBackup(studioId, backupData, 'merge');
    console.log('✅ Import finished successfully:');
    console.log(`   - Imported Projects: ${result.importedProjectsCount}`);
    console.log(`   - Imported Invoices: ${result.importedInvoicesCount}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedFromBackup();
