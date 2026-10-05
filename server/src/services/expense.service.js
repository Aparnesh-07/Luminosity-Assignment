const { query } = require('../config/database');

/**
 * Get all expenses for a project
 */
exports.getExpensesByProject = async (studioId, projectId) => {
  const [projects] = await query(
    `SELECT id FROM projects WHERE id = ? AND studio_id = ?`,
    [projectId, studioId]
  );
  if (!projects || projects.length === 0) {
    throw new Error('Project not found');
  }

  const [rows] = await query(
    `SELECT id, project_id, category, description, amount, expense_date, payment_method, notes, created_at, updated_at
     FROM expenses 
     WHERE project_id = ? 
     ORDER BY id ASC`,
    [projectId]
  );

  return rows.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    title: e.category || 'General Expense',
    category: e.category || 'General Expense',
    description: e.description || '',
    amount: parseFloat(e.amount) || 0,
    date: e.expense_date ? e.expense_date.toISOString?.().slice(0, 10) || String(e.expense_date).slice(0, 10) : '',
    paymentMethod: e.payment_method || '',
    notes: e.notes || '',
    createdAt: e.created_at ? new Date(e.created_at).getTime() : Date.now()
  }));
};

/**
 * Create a new expense for a project
 */
exports.createExpense = async (studioId, projectId, data) => {
  const [projects] = await query(
    `SELECT id FROM projects WHERE id = ? AND studio_id = ?`,
    [projectId, studioId]
  );
  if (!projects || projects.length === 0) {
    throw new Error('Project not found');
  }

  const category = data.title || data.category || 'General Expense';
  const description = data.description || '';
  const amount = parseFloat(data.amount) || 0;
  const expenseDate = data.date || data.expenseDate || new Date().toISOString().slice(0, 10);
  const paymentMethod = data.paymentMethod || data.method || '';
  const notes = data.notes || '';

  const [result] = await query(
    `INSERT INTO expenses (project_id, category, description, amount, expense_date, payment_method, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, category, description, amount, expenseDate, paymentMethod, notes]
  );

  return {
    id: result.insertId,
    projectId: parseInt(projectId, 10),
    title: category,
    category,
    description,
    amount,
    date: expenseDate,
    paymentMethod,
    notes
  };
};

/**
 * Update an existing expense
 */
exports.updateExpense = async (studioId, expenseId, data) => {
  const [rows] = await query(
    `SELECT e.*, p.studio_id 
     FROM expenses e
     JOIN projects p ON e.project_id = p.id
     WHERE e.id = ? AND p.studio_id = ?`,
    [expenseId, studioId]
  );
  if (!rows || rows.length === 0) {
    throw new Error('Expense not found');
  }

  const prev = rows[0];
  const category = data.title !== undefined ? data.title : data.category !== undefined ? data.category : prev.category;
  const description = data.description !== undefined ? data.description : prev.description;
  const amount = data.amount !== undefined ? parseFloat(data.amount) : prev.amount;
  const expenseDate = data.date || data.expenseDate || prev.expense_date;
  const paymentMethod = data.paymentMethod !== undefined ? data.paymentMethod : prev.payment_method;
  const notes = data.notes !== undefined ? data.notes : prev.notes;

  await query(
    `UPDATE expenses 
     SET category = ?, description = ?, amount = ?, expense_date = ?, 
         payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [category, description, amount, expenseDate, paymentMethod, notes, expenseId]
  );

  return {
    id: parseInt(expenseId, 10),
    projectId: prev.project_id,
    title: category,
    category,
    description,
    amount,
    date: expenseDate,
    paymentMethod,
    notes
  };
};

/**
 * Delete an expense
 */
exports.deleteExpense = async (studioId, expenseId) => {
  const [rows] = await query(
    `SELECT e.id, e.project_id, p.studio_id 
     FROM expenses e
     JOIN projects p ON e.project_id = p.id
     WHERE e.id = ? AND p.studio_id = ?`,
    [expenseId, studioId]
  );
  if (!rows || rows.length === 0) {
    throw new Error('Expense not found');
  }

  await query(`DELETE FROM expenses WHERE id = ?`, [expenseId]);
  return { id: parseInt(expenseId, 10), projectId: rows[0].project_id };
};
