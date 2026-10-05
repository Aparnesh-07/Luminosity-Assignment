require('dotenv').config();
const app = require('./app');
const { initDatabase } = require('./config/database');
const { ensureSeedAdmin } = require('./services/auth.service');

const PORT = parseInt(process.env.PORT, 10) || 5000;

async function startServer() {
  try {
    console.log('🚀 Connecting to MySQL and verifying database schema...');
    try {
      await initDatabase();
      await ensureSeedAdmin();
    } catch (dbErr) {
      console.warn('⚠️ Database connection deferred or running without auto-migration:', dbErr.message);
      console.warn('💡 You can run `npm run migrate` once MySQL is active.');
    }

    const server = app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`✨ LUMINOSITY STUDIO SUITE API SERVER`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`======================================================\n`);
    });

    const shutdown = () => {
      console.log('\n🛑 Gracefully shutting down server...');
      server.close(() => {
        console.log('Server terminated cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
