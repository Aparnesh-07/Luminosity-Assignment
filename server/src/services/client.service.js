const { query } = require('../config/database');

/**
 * List clients for a studio with project counts and revenue summary
 */
exports.listClients = async (studioId, { search = '', sort = 'name', order = 'asc' }) => {
  let sql = `
    SELECT 
      c.id, c.studio_id, c.name, c.company, c.phone, c.email, c.address, c.notes,
      c.created_at, c.updated_at,
      COUNT(DISTINCT p.id) as project_count,
      COALESCE(SUM(p.budget), 0) as total_revenue
    FROM clients c
    LEFT JOIN projects p ON p.client_id = c.id
    WHERE c.studio_id = ?
  `;
  const params = [studioId];

  if (search.trim()) {
    sql += ` AND (c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  sql += ` GROUP BY c.id`;

  const validSorts = ['name', 'company', 'created_at', 'project_count', 'total_revenue'];
  const sortCol = validSorts.includes(sort) ? sort : 'name';
  const sortDir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  sql += ` ORDER BY ${sortCol} ${sortDir}`;

  const [rows] = await query(sql, params);
  return rows;
};

/**
 * Get single client by ID with related projects
 */
exports.getClientById = async (studioId, clientId) => {
  const [clients] = await query(
    `SELECT * FROM clients WHERE id = ? AND studio_id = ? LIMIT 1`,
    [clientId, studioId]
  );

  if (!clients || clients.length === 0) {
    throw new Error('Client not found');
  }

  const client = clients[0];

  const [projects] = await query(
    `SELECT id, title, status, budget, start_date, end_date, created_at 
     FROM projects 
     WHERE client_id = ? AND studio_id = ? 
     ORDER BY created_at DESC`,
    [clientId, studioId]
  );

  return {
    ...client,
    projects
  };
};

/**
 * Find or create a client by name (convenience for project creation)
 */
exports.findOrCreateByName = async (studioId, name, company = '') => {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  const [existing] = await query(
    `SELECT id FROM clients WHERE studio_id = ? AND LOWER(name) = LOWER(?) LIMIT 1`,
    [studioId, trimmed]
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [created] = await query(
    `INSERT INTO clients (studio_id, name, company) VALUES (?, ?, ?)`,
    [studioId, trimmed, company]
  );

  return created.insertId;
};

/**
 * Create a new client
 */
exports.createClient = async (studioId, data) => {
  const { name, company = '', phone = '', email = '', address = '', notes = '' } = data;
  if (!name || !name.trim()) {
    throw new Error('Client name is required');
  }

  const [result] = await query(
    `INSERT INTO clients (studio_id, name, company, phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [studioId, name.trim(), company.trim(), phone.trim(), email.trim(), address.trim(), notes.trim()]
  );

  return exports.getClientById(studioId, result.insertId);
};

/**
 * Update an existing client
 */
exports.updateClient = async (studioId, clientId, data) => {
  const { name, company, phone, email, address, notes } = data;

  const [existing] = await query(
    `SELECT id FROM clients WHERE id = ? AND studio_id = ?`,
    [clientId, studioId]
  );
  if (!existing || existing.length === 0) {
    throw new Error('Client not found');
  }

  await query(
    `UPDATE clients 
     SET name = COALESCE(?, name),
         company = COALESCE(?, company),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         address = COALESCE(?, address),
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND studio_id = ?`,
    [name, company, phone, email, address, notes, clientId, studioId]
  );

  return exports.getClientById(studioId, clientId);
};

/**
 * Delete client
 */
exports.deleteClient = async (studioId, clientId) => {
  const [existing] = await query(
    `SELECT id FROM clients WHERE id = ? AND studio_id = ?`,
    [clientId, studioId]
  );
  if (!existing || existing.length === 0) {
    throw new Error('Client not found');
  }

  await query(`DELETE FROM clients WHERE id = ? AND studio_id = ?`, [clientId, studioId]);
  return { id: clientId };
};
