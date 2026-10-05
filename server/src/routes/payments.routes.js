const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// Routes nested under /api/projects/:id/payments
router.get('/projects/:id/payments', requireAuth, paymentsController.getProjectPayments);
router.post('/projects/:id/payments', requireAuth, paymentsController.createProjectPayment);
router.post('/projects/:id/settle', requireAuth, paymentsController.quickSettleProject);

// Direct payment entity routes
router.put('/payments/:id', requireAuth, paymentsController.updatePayment);
router.delete('/payments/:id', requireAuth, paymentsController.deletePayment);

module.exports = router;
