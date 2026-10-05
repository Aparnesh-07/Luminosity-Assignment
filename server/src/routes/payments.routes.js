const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

// Routes nested under /api/projects/:id/payments
router.get('/projects/:id/payments', paymentsController.getProjectPayments);
router.post('/projects/:id/payments', paymentsController.createProjectPayment);
router.post('/projects/:id/settle', paymentsController.quickSettleProject);

// Direct payment entity routes
router.put('/payments/:id', paymentsController.updatePayment);
router.delete('/payments/:id', paymentsController.deletePayment);

module.exports = router;
