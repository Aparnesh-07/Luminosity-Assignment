const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const errorHandler = require('./middleware/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const clientsRoutes = require('./routes/clients.routes');
const projectsRoutes = require('./routes/projects.routes');
const paymentsRoutes = require('./routes/payments.routes');
const expensesRoutes = require('./routes/expenses.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const settingsRoutes = require('./routes/settings.routes');
const backupsRoutes = require('./routes/backups.routes');

const app = express();

// Security and utility middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Automatically allow all Vercel domains (production & branch previews) and localhost
      if (origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      // If a specific CLIENT_URL is defined and matches, allow it
      const clientUrl = process.env.CLIENT_URL;
      if (clientUrl && (clientUrl === '*' || clientUrl === origin)) {
        return callback(null, true);
      }

      // Fallback: allow the origin
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static uploads directory for logos / media
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Root and health check endpoints
app.get('/', (req, res) => {
  res.json({
    name: 'Luminosity Studio Suite API',
    status: 'online',
    health: '/api/health'
  });
});

app.get(['/health', '/api/health'], async (req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;
  let tables = [];
  try {
    const { query } = require('./config/database');
    const [rows] = await query('SHOW TABLES');
    dbStatus = 'connected';
    tables = rows.map((r) => Object.values(r)[0]);
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      error: dbError,
      tables
    }
  });
});

app.get('/api/setup-db', async (req, res) => {
  try {
    const { initDatabase, query } = require('./config/database');
    const { ensureSeedAdmin } = require('./services/auth.service');
    await initDatabase();
    await ensureSeedAdmin();
    const [rows] = await query('SHOW TABLES');
    res.json({
      success: true,
      message: 'Database migrated and seeded successfully!',
      tables: rows.map((r) => Object.values(r)[0])
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', expensesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backups', backupsRoutes);

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
