const { query, getConnection } = require('../config/database');
const clientService = require('./client.service');

/**
 * Format project row into full object with items and financial metrics
 */
function formatProject(project, payments = [], expenses = []) {
  const budget = parseFloat(project.budget) || 0;
  const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  const outstanding = Math.max(0, budget - totalPaid);
  const profit = budget - totalExpenses;
  const margin = budget > 0 ? Math.round((profit / budget) * 100) : 0;

  return {
    id: project.id,
    studioId: project.studio_id,
    clientId: project.client_id,
    clientName: project.client_name || project.title,
    title: project.title,
    description: project.description || '',
    deliverables: project.description || '', // Alias for frontend compatibility
    status: project.status,
    startDate: project.start_date ? project.start_date.toISOString?.().slice(0, 10) || String(project.start_date).slice(0, 10) : '',
    endDate: project.end_date ? project.end_date.toISOString?.().slice(0, 10) || String(project.end_date).slice(0, 10) : '',
    budget: budget,
    payment: budget, // Alias for frontend compatibility
    priority: project.priority || 'medium',
    legacyId: project.legacy_id,
    createdAt: project.created_at ? new Date(project.created_at).getTime() : Date.now(),
    updatedAt: project.updated_at ? new Date(project.updated_at).getTime() : Date.now(),
    // Calculated aggregates
    totalPaid,
    paid: totalPaid,
    totalExpenses,
    expenses: totalExpenses,
    outstanding,
    remaining: outstanding,
    profit,
    margin,
    // Child records
    paymentRecords: payments.map((p) => ({
      id: p.id,
      projectId: p.project_id,
      amount: parseFloat(p.amount) || 0,
      date: p.payment_date ? p.payment_date.toISOString?.().slice(0, 10) || String(p.payment_date).slice(0, 10) : '',
      method: p.method || 'UPI',
      note: p.reference || p.notes || '',
      legacyId: p.legacy_id,
      createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now()
    })),
    expenseItems: expenses.map((e) => ({
      id: e.id,
      projectId: e.project_id,
      title: e.category || 'General Expense',
      description: e.description || '',
      amount: parseFloat(e.amount) || 0,
      date: e.expense_date ? e.expense_date.toISOString?.().slice(0, 10) || String(e.expense_date).slice(0, 10) : '',
      createdAt: e.created_at ? new Date(e.created_at).getTime() : Date.now()
    }))
  };
}

/**
 * List projects with filters and full associated details
 */
exports.listProjects = async (studioId, filters = {}) => {
  const { status, search, startDate, endDate, sort = 'start_date', order = 'asc' } = filters;

  let sql = `
    SELECT p.*, c.name as client_name, c.company as client_company
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.studio_id = ?
  `;
  const params = [studioId];

  if (status && status !== 'all') {
    sql += ` AND p.status = ?`;
    params.push(status);
  }

  if (startDate) {
    sql += ` AND (p.start_date >= ? OR p.end_date >= ?)`;
    params.push(startDate, startDate);
  }

  if (endDate) {
    sql += ` AND (p.start_date <= ? OR p.end_date <= ?)`;
    params.push(endDate, endDate);
  }

  if (search && search.trim()) {
    sql += ` AND (p.title LIKE ? OR p.description LIKE ? OR c.name LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const validSorts = {
    date: 'p.start_date',
    start_date: 'p.start_date',
    title: 'p.title',
    payment: 'p.budget',
    budget: 'p.budget',
    status: 'p.status',
    created_at: 'p.created_at'
  };
  const sortCol = validSorts[sort] || 'p.start_date';
  const sortDir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  sql += ` ORDER BY ${sortCol} ${sortDir}, p.id DESC`;

  const [projectRows] = await query(sql, params);
  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => p.id);

  // Fetch payments and expenses in bulk for efficiency
  const [paymentRows] = await query(
    `SELECT * FROM payments WHERE project_id IN (?) ORDER BY payment_date ASC, id ASC`,
    [projectIds]
  );

  const [expenseRows] = await query(
    `SELECT * FROM expenses WHERE project_id IN (?) ORDER BY id ASC`,
    [projectIds]
  );

  const paymentsByProject = {};
  paymentRows.forEach((p) => {
    if (!paymentsByProject[p.project_id]) paymentsByProject[p.project_id] = [];
    paymentsByProject[p.project_id].push(p);
  });

  const expensesByProject = {};
  expenseRows.forEach((e) => {
    if (!expensesByProject[e.project_id]) expensesByProject[e.project_id] = [];
    expensesByProject[e.project_id].push(e);
  });

  return projectRows.map((p) =>
    formatProject(p, paymentsByProject[p.id] || [], expensesByProject[p.id] || [])
  );
};

/**
 * Get single project by ID with full details
 */
exports.getProjectById = async (studioId, projectId) => {
  const [projects] = await query(
    `SELECT p.*, c.name as client_name, c.company as client_company
     FROM projects p
     LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.id = ? AND p.studio_id = ? LIMIT 1`,
    [projectId, studioId]
  );

  if (!projects || projects.length === 0) {
    throw new Error('Project not found');
  }

  const [payments] = await query(
    `SELECT * FROM payments WHERE project_id = ? ORDER BY payment_date ASC, id ASC`,
    [projectId]
  );

  const [expenses] = await query(
    `SELECT * FROM expenses WHERE project_id = ? ORDER BY id ASC`,
    [projectId]
  );

  return formatProject(projects[0], payments, expenses);
};

/**
 * Create a new project (with optional itemized expenses and client link)
 */
exports.createProject = async (studioId, data) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const {
      title,
      description = '',
      deliverables = '',
      status = 'upcoming',
      startDate = null,
      endDate = null,
      budget = 0,
      payment = 0,
      priority = 'medium',
      clientId = null,
      clientName = null,
      expenseItems = [],
      legacyId = null
    } = data;

    if (!title || !title.trim()) {
      throw new Error('Project title is required');
    }

    const finalDescription = description || deliverables;
    const finalBudget = parseFloat(budget) || parseFloat(payment) || 0;

    let finalClientId = clientId;
    if (!finalClientId && clientName) {
      finalClientId = await clientService.findOrCreateByName(studioId, clientName);
    }

    const [result] = await connection.query(
      `INSERT INTO projects 
       (studio_id, client_id, title, description, status, start_date, end_date, budget, priority, legacy_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studioId,
        finalClientId,
        title.trim(),
        finalDescription.trim(),
        status,
        startDate || null,
        endDate || startDate || null,
        finalBudget,
        priority,
        legacyId
      ]
    );

    const projectId = result.insertId;

    // Insert expense items if provided
    if (Array.isArray(expenseItems) && expenseItems.length > 0) {
      for (const item of expenseItems) {
        const itemAmount = parseFloat(item.amount) || 0;
        if (itemAmount > 0 || (item.title && item.title.trim())) {
          await connection.query(
            `INSERT INTO expenses (project_id, category, description, amount, expense_date)
             VALUES (?, ?, ?, ?, ?)`,
            [
              projectId,
              item.title || item.category || 'General Expense',
              item.description || '',
              itemAmount,
              startDate || null
            ]
          );
        }
      }
    }

    await connection.commit();
    return exports.getProjectById(studioId, projectId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Update an existing project
 */
exports.updateProject = async (studioId, projectId, data) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT * FROM projects WHERE id = ? AND studio_id = ?`,
      [projectId, studioId]
    );
    if (!existing || existing.length === 0) {
      throw new Error('Project not found');
    }

    const prev = existing[0];
    const title = data.title !== undefined ? data.title : prev.title;
    const description =
      data.description !== undefined
        ? data.description
        : data.deliverables !== undefined
        ? data.deliverables
        : prev.description;
    const status = data.status !== undefined ? data.status : prev.status;
    const startDate = data.startDate !== undefined ? data.startDate : prev.start_date;
    const endDate = data.endDate !== undefined ? data.endDate : prev.end_date;
    const budget =
      data.budget !== undefined
        ? parseFloat(data.budget)
        : data.payment !== undefined
        ? parseFloat(data.payment)
        : prev.budget;
    const priority = data.priority !== undefined ? data.priority : prev.priority;
    const clientId = data.clientId !== undefined ? data.clientId : prev.client_id;

    await connection.query(
      `UPDATE projects 
       SET title = ?, description = ?, status = ?, start_date = ?, end_date = ?, 
           budget = ?, priority = ?, client_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND studio_id = ?`,
      [
        title,
        description,
        status,
        startDate || null,
        endDate || startDate || null,
        budget,
        priority,
        clientId,
        projectId,
        studioId
      ]
    );

    // If expenseItems is explicitly passed, replace existing expenses
    if (Array.isArray(data.expenseItems)) {
      await connection.query(`DELETE FROM expenses WHERE project_id = ?`, [projectId]);
      for (const item of data.expenseItems) {
        const itemAmount = parseFloat(item.amount) || 0;
        if (itemAmount > 0 || (item.title && item.title.trim())) {
          await connection.query(
            `INSERT INTO expenses (project_id, category, description, amount, expense_date)
             VALUES (?, ?, ?, ?, ?)`,
            [
              projectId,
              item.title || item.category || 'General Expense',
              item.description || '',
              itemAmount,
              startDate || null
            ]
          );
        }
      }
    }

    await connection.commit();
    return exports.getProjectById(studioId, projectId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Delete a project and all associated records (payments, expenses)
 */
exports.deleteProject = async (studioId, projectId) => {
  const [existing] = await query(
    `SELECT id, title FROM projects WHERE id = ? AND studio_id = ?`,
    [projectId, studioId]
  );
  if (!existing || existing.length === 0) {
    throw new Error('Project not found');
  }

  await query(`DELETE FROM projects WHERE id = ? AND studio_id = ?`, [projectId, studioId]);
  return { id: projectId, title: existing[0].title };
};

/**
 * Authoritative financial calculation for a project from MySQL
 */
exports.getProjectFinancials = async (studioId, projectId) => {
  const [projects] = await query(
    `SELECT id, title, budget FROM projects WHERE id = ? AND studio_id = ? LIMIT 1`,
    [projectId, studioId]
  );

  if (!projects || projects.length === 0) {
    throw new Error('Project not found');
  }

  const budget = parseFloat(projects[0].budget) || 0;

  const [paymentRows] = await query(
    `SELECT COALESCE(SUM(amount), 0) as totalPaid FROM payments WHERE project_id = ?`,
    [projectId]
  );
  const [expenseRows] = await query(
    `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE project_id = ?`,
    [projectId]
  );

  const totalPaid = parseFloat(paymentRows[0].totalPaid) || 0;
  const totalExpenses = parseFloat(expenseRows[0].totalExpenses) || 0;
  const outstanding = Math.max(0, budget - totalPaid);
  const profit = budget - totalExpenses;
  const margin = budget > 0 ? Math.round((profit / budget) * 100) : 0;

  return {
    projectId: parseInt(projectId, 10),
    title: projects[0].title,
    budget,
    totalPaid,
    totalExpenses,
    outstanding,
    profit,
    margin,
    isSettled: budget > 0 && totalPaid >= budget
  };
};
