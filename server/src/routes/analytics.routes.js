const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

router.get('/overview', analyticsController.getOverview);
router.get('/payments', analyticsController.getPaymentsOverview);

module.exports = router;
