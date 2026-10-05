const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expenses.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// Routes nested under /api/projects/:id/expenses
router.get('/projects/:id/expenses', requireAuth, expensesController.getProjectExpenses);
router.post('/projects/:id/expenses', requireAuth, expensesController.createProjectExpense);

// Direct expense entity routes
router.put('/expenses/:id', requireAuth, expensesController.updateExpense);
router.delete('/expenses/:id', requireAuth, expensesController.deleteExpense);

module.exports = router;
