const express = require('express');
const router = express.Router();
const backupsController = require('../controllers/backups.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

router.get('/export', backupsController.exportBackup);
router.post('/import', backupsController.importBackup);

module.exports = router;
