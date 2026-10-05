const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { uploadLogo } = require('../middleware/upload.middleware');

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.post('/logo', uploadLogo.single('logo'), settingsController.uploadLogo);
router.delete('/logo', settingsController.deleteLogo);
router.post('/reset-sequence', settingsController.resetSequence);

module.exports = router;
