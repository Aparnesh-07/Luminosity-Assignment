const express = require('express');
const router = express.Router();
const invoicesController = require('../controllers/invoices.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

router.get('/', invoicesController.listInvoices);
router.get('/next-number', invoicesController.generateNextNumber);
router.get('/:id', invoicesController.getInvoice);
router.post('/', invoicesController.createInvoice);
router.put('/:id', invoicesController.updateInvoice);
router.delete('/:id', invoicesController.deleteInvoice);

module.exports = router;
