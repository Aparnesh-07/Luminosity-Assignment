const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expenses.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

// Routes nested under /api/projects/:id/expenses
router.get('/projects/:id/expenses', expensesController.getProjectExpenses);
router.post('/projects/:id/expenses', expensesController.createProjectExpense);

// Direct expense entity routes
router.put('/expenses/:id', expensesController.updateExpense);
router.delete('/expenses/:id', expensesController.deleteExpense);

module.exports = router;
