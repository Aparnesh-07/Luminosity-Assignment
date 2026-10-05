const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projects.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

router.get('/', projectsController.listProjects);
router.get('/:id', projectsController.getProject);
router.post('/', projectsController.createProject);
router.put('/:id', projectsController.updateProject);
router.delete('/:id', projectsController.deleteProject);
router.get('/:id/financials', projectsController.getFinancials);

module.exports = router;
