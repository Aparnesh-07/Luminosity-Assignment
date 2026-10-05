const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hasUri = Boolean(process.env.MYSQL_URL || process.env.DATABASE_URL);

const dbConfig = hasUri
  ? {
      uri: process.env.MYSQL_URL || process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      decimalNumbers: true,
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false }
    }
  : {
      host: process.env.MYSQLHOST || process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT, 10) || 3306,
      user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
      password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'luminosity_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      decimalNumbers: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    };

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

/**
 * Initializes the database and executes schema migrations if tables do not exist
 */
async function initDatabase() {
  try {
    // If not using a managed URI with pre-created DB, attempt to ensure DB exists
    if (!hasUri) {
      try {
        const rootConnection = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.user,
          password: dbConfig.password,
          multipleStatements: true,
          ssl: dbConfig.ssl
        });

        await rootConnection.query(
          `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
        );
        await rootConnection.end();
      } catch (dbCreateErr) {
        // Ignored on managed cloud databases where the database already exists
        console.warn('ℹ️ Managed database in use, continuing with schema migration...');
      }
    }

    // Now connect to the database and run schema migration
    const dbPool = getPool();
    const schemaPath = path.join(__dirname, '../../migrations/001_initial_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await dbPool.query(schemaSql);
      console.log('✅ Database schema verified / migrated successfully.');
    }

    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error(
        `👉 Could not connect to MySQL at ${dbConfig.host}:${dbConfig.port}. Please ensure MySQL / MariaDB (e.g. via XAMPP or Homebrew) is running.`
      );
    }
    throw error;
  }
}

module.exports = {
  getPool,
  initDatabase,
  query: (...args) => getPool().query(...args),
  getConnection: () => getPool().getConnection()
};
