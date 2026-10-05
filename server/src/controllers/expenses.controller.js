const expenseService = require('../services/expense.service');
const { success, error } = require('../utils/response');

exports.getProjectExpenses = async (req, res, next) => {
  try {
    const expenses = await expenseService.getExpensesByProject(req.user.studioId, req.params.id);
    return success(res, expenses);
  } catch (err) {
    next(err);
  }
};

exports.createProjectExpense = async (req, res, next) => {
  try {
    const result = await expenseService.createExpense(req.user.studioId, req.params.id, req.body);
    return success(res, result, 'Expense recorded successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.updateExpense = async (req, res, next) => {
  try {
    const result = await expenseService.updateExpense(req.user.studioId, req.params.id, req.body);
    return success(res, result, 'Expense updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const result = await expenseService.deleteExpense(req.user.studioId, req.params.id);
    return success(res, result, 'Expense deleted successfully');
  } catch (err) {
    next(err);
  }
};
