const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clients.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

router.get('/', clientsController.listClients);
router.get('/:id', clientsController.getClient);
router.post('/', clientsController.createClient);
router.put('/:id', clientsController.updateClient);
router.delete('/:id', clientsController.deleteClient);

module.exports = router;
