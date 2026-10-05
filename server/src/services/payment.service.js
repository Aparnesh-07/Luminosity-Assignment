const { query, getConnection } = require('../config/database');

/**
 * Get all payments for a specific project
 */
exports.getPaymentsByProject = async (studioId, projectId) => {
  // Ensure project belongs to user's studio
  const [projects] = await query(
    `SELECT id FROM projects WHERE id = ? AND studio_id = ?`,
    [projectId, studioId]
  );
  if (!projects || projects.length === 0) {
    throw new Error('Project not found');
  }

  const [rows] = await query(
    `SELECT id, project_id, amount, payment_date, method, reference, notes, legacy_id, created_at, updated_at
     FROM payments 
     WHERE project_id = ? 
     ORDER BY payment_date DESC, id DESC`,
    [projectId]
  );

  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    amount: parseFloat(r.amount) || 0,
    date: r.payment_date ? r.payment_date.toISOString?.().slice(0, 10) || String(r.payment_date).slice(0, 10) : '',
    method: r.method || 'UPI',
    reference: r.reference || '',
    note: r.reference || r.notes || '',
    legacyId: r.legacy_id,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
  }));
};

/**
 * Record a payment for a project (and auto-mark project completed if fully settled)
 */
exports.createPayment = async (studioId, projectId, data) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const [projects] = await connection.query(
      `SELECT id, title, budget, status FROM projects WHERE id = ? AND studio_id = ?`,
      [projectId, studioId]
    );
    if (!projects || projects.length === 0) {
      throw new Error('Project not found');
    }

    const project = projects[0];
    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const paymentDate = data.date || data.paymentDate || new Date().toISOString().slice(0, 10);
    const method = data.method || 'UPI';
    const reference = data.note || data.reference || '';
    const notes = data.notes || '';

    const [result] = await connection.query(
      `INSERT INTO payments (project_id, amount, payment_date, method, reference, notes, legacy_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, amount, paymentDate, method, reference, notes, data.legacyId || null]
    );

    const paymentId = result.insertId;

    // Check if total paid reaches or exceeds budget
    const [sumRow] = await connection.query(
      `SELECT COALESCE(SUM(amount), 0) as totalPaid FROM payments WHERE project_id = ?`,
      [projectId]
    );
    const totalPaid = parseFloat(sumRow[0].totalPaid) || 0;
    const budget = parseFloat(project.budget) || 0;

    let autoCompleted = false;
    if (budget > 0 && totalPaid >= budget && project.status !== 'completed') {
      await connection.query(
        `UPDATE projects SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [projectId]
      );
      autoCompleted = true;
    }

    await connection.commit();

    return {
      payment: {
        id: paymentId,
        projectId: parseInt(projectId, 10),
        amount,
        date: paymentDate,
        method,
        note: reference,
        reference
      },
      project: {
        id: project.id,
        title: project.title,
        budget,
        totalPaid,
        remaining: Math.max(0, budget - totalPaid),
        status: autoCompleted ? 'completed' : project.status,
        autoCompleted
      }
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Quick settle all remaining balance for a project
 */
exports.quickSettle = async (studioId, projectId) => {
  const [projects] = await query(
    `SELECT id, title, budget, status FROM projects WHERE id = ? AND studio_id = ?`,
    [projectId, studioId]
  );
  if (!projects || projects.length === 0) {
    throw new Error('Project not found');
  }

  const project = projects[0];
  const [sumRow] = await query(
    `SELECT COALESCE(SUM(amount), 0) as totalPaid FROM payments WHERE project_id = ?`,
    [projectId]
  );
  const totalPaid = parseFloat(sumRow[0].totalPaid) || 0;
  const budget = parseFloat(project.budget) || 0;
  const remaining = Math.max(0, budget - totalPaid);

  if (remaining <= 0) {
    throw new Error('This project is already fully settled.');
  }

  return exports.createPayment(studioId, projectId, {
    amount: remaining,
    date: new Date().toISOString().slice(0, 10),
    method: 'UPI',
    note: 'Full Balance Settlement'
  });
};

/**
 * Update an existing payment
 */
exports.updatePayment = async (studioId, paymentId, data) => {
  const [rows] = await query(
    `SELECT py.*, p.studio_id 
     FROM payments py
     JOIN projects p ON py.project_id = p.id
     WHERE py.id = ? AND p.studio_id = ?`,
    [paymentId, studioId]
  );
  if (!rows || rows.length === 0) {
    throw new Error('Payment not found');
  }

  const prev = rows[0];
  const amount = data.amount !== undefined ? parseFloat(data.amount) : prev.amount;
  const paymentDate = data.date || data.paymentDate || prev.payment_date;
  const method = data.method !== undefined ? data.method : prev.method;
  const reference = data.note !== undefined ? data.note : data.reference !== undefined ? data.reference : prev.reference;

  await query(
    `UPDATE payments 
     SET amount = ?, payment_date = ?, method = ?, reference = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [amount, paymentDate, method, reference, paymentId]
  );

  return {
    id: parseInt(paymentId, 10),
    projectId: prev.project_id,
    amount,
    date: paymentDate,
    method,
    note: reference
  };
};

/**
 * Delete a payment
 */
exports.deletePayment = async (studioId, paymentId) => {
  const [rows] = await query(
    `SELECT py.id, py.project_id, p.studio_id 
     FROM payments py
     JOIN projects p ON py.project_id = p.id
     WHERE py.id = ? AND p.studio_id = ?`,
    [paymentId, studioId]
  );
  if (!rows || rows.length === 0) {
    throw new Error('Payment not found');
  }

  await query(`DELETE FROM payments WHERE id = ?`, [paymentId]);
  return { id: parseInt(paymentId, 10), projectId: rows[0].project_id };
};
