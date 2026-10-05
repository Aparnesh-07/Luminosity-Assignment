const { query, getConnection } = require('../config/database');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Atomically generates next sequential invoice number in MySQL
 * Format: MON + SEQ(2) + RAND(2) -> e.g. AUG0113
 */
exports.generateInvoiceNumber = async (studioId, invoiceDate = new Date()) => {
  const date = new Date(invoiceDate);
  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const monthStr = MONTHS[date.getMonth()];

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO invoice_sequences (studio_id, \`year_month\`, last_seq)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
      [studioId, yearMonth]
    );

    const [rows] = await connection.query(
      `SELECT last_seq FROM invoice_sequences WHERE studio_id = ? AND \`year_month\` = ?`,
      [studioId, yearMonth]
    );

    await connection.commit();

    const seq = String(rows[0].last_seq).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    return `${monthStr}${seq}${rand}`;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Format invoice row and its items into API response
 */
function formatInvoice(inv, items = []) {
  const subtotal = parseFloat(inv.subtotal) || 0;
  const discount = parseFloat(inv.discount) || 0;
  const advance = parseFloat(inv.advance) || 0;
  const total = parseFloat(inv.total) || 0;

  return {
    id: inv.invoice_number || String(inv.id),
    numericId: inv.id,
    studioId: inv.studio_id,
    clientId: inv.client_id,
    projectId: inv.project_id,
    invoiceNumber: inv.invoice_number,
    date: inv.invoice_date ? inv.invoice_date.toISOString?.().slice(0, 10) || String(inv.invoice_date).slice(0, 10) : '',
    billName: inv.bill_name || '',
    billCompany: inv.bill_company || '',
    billPhone: inv.bill_phone || '',
    billEmail: inv.bill_email || '',
    project: inv.project_scope || '',
    projectScope: inv.project_scope || '',
    subtotal,
    discount,
    advance,
    total,
    status: inv.status || 'draft',
    terms: inv.terms || '',
    legacyId: inv.legacy_id,
    savedAt: inv.created_at ? new Date(inv.created_at).getTime() : Date.now(),
    createdAt: inv.created_at ? new Date(inv.created_at).getTime() : Date.now(),
    updatedAt: inv.updated_at ? new Date(inv.updated_at).getTime() : Date.now(),
    items: items.map((it, idx) => ({
      id: it.id,
      key: it.id ? `itm_${it.id}` : `itm_tmp_${idx}`,
      description: it.description || '',
      qty: parseFloat(it.quantity) || 1,
      quantity: parseFloat(it.quantity) || 1,
      price: parseFloat(it.unit_price) || 0,
      unitPrice: parseFloat(it.unit_price) || 0,
      amount: parseFloat(it.amount) || 0
    }))
  };
}

/**
 * List invoices with filters and search
 */
exports.listInvoices = async (studioId, filters = {}) => {
  const { search, status, startDate, endDate, sort = 'invoice_date', order = 'desc' } = filters;

  let sql = `SELECT * FROM invoices WHERE studio_id = ?`;
  const params = [studioId];

  if (status && status !== 'all') {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (startDate) {
    sql += ` AND invoice_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND invoice_date <= ?`;
    params.push(endDate);
  }

  if (search && search.trim()) {
    sql += ` AND (invoice_number LIKE ? OR bill_name LIKE ? OR bill_company LIKE ? OR project_scope LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const validSorts = {
    date: 'invoice_date',
    invoice_date: 'invoice_date',
    total: 'total',
    number: 'invoice_number',
    invoice_number: 'invoice_number',
    name: 'bill_name',
    created_at: 'created_at'
  };
  const sortCol = validSorts[sort] || 'invoice_date';
  const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  sql += ` ORDER BY ${sortCol} ${sortDir}, id DESC`;

  const [invoices] = await query(sql, params);
  if (invoices.length === 0) return [];

  const invoiceIds = invoices.map((i) => i.id);

  const [items] = await query(
    `SELECT * FROM invoice_items WHERE invoice_id IN (?) ORDER BY sort_order ASC, id ASC`,
    [invoiceIds]
  );

  const itemsByInvoice = {};
  items.forEach((it) => {
    if (!itemsByInvoice[it.invoice_id]) itemsByInvoice[it.invoice_id] = [];
    itemsByInvoice[it.invoice_id].push(it);
  });

  return invoices.map((inv) => formatInvoice(inv, itemsByInvoice[inv.id] || []));
};

/**
 * Get single invoice by ID or Invoice Number
 */
exports.getInvoice = async (studioId, identifier) => {
  const isNumeric = /^\d+$/.test(String(identifier));
  const whereClause = isNumeric
    ? `(id = ? OR invoice_number = ?)`
    : `invoice_number = ?`;
  const params = isNumeric ? [identifier, identifier, studioId] : [identifier, studioId];

  const [invoices] = await query(
    `SELECT * FROM invoices WHERE ${whereClause} AND studio_id = ? LIMIT 1`,
    params
  );

  if (!invoices || invoices.length === 0) {
    throw new Error('Invoice not found');
  }

  const invoice = invoices[0];
  const [items] = await query(
    `SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC`,
    [invoice.id]
  );

  return formatInvoice(invoice, items);
};

/**
 * Create a new invoice with transaction
 */
exports.createInvoice = async (studioId, data) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const invoiceDate = data.date || data.invoiceDate || new Date().toISOString().slice(0, 10);
    const invoiceNumber =
      data.id && data.id !== 'NEW' && !data.id.startsWith('draft')
        ? data.id
        : await exports.generateInvoiceNumber(studioId, invoiceDate);

    const billName = data.billName || '';
    const billCompany = data.billCompany || '';
    const billPhone = data.billPhone || '';
    const billEmail = data.billEmail || '';
    const projectScope = data.project || data.projectScope || '';
    const discount = parseFloat(data.discount) || 0;
    const advance = parseFloat(data.advance) || 0;
    const terms = data.terms || '';
    const status = data.status || 'draft';
    const legacyId = data.legacyId || null;
    const clientId = data.clientId || null;
    const projectId = data.projectId || null;

    // 1. Calculate items and subtotal authoritatively
    const rawItems = Array.isArray(data.items) ? data.items : [];
    let subtotal = 0;
    const calculatedItems = rawItems.map((item, idx) => {
      const qty = parseFloat(item.qty || item.quantity) || 1;
      const price = parseFloat(item.price || item.unitPrice) || 0;
      const amount = qty * price;
      subtotal += amount;
      return {
        description: item.description || '',
        quantity: qty,
        unitPrice: price,
        amount,
        sortOrder: idx
      };
    });

    const total = Math.max(0, subtotal - discount - advance);

    // 2. Insert Invoice
    const [invResult] = await connection.query(
      `INSERT INTO invoices 
       (studio_id, client_id, project_id, invoice_number, invoice_date, bill_name, bill_company, bill_phone, bill_email, project_scope, subtotal, discount, advance, total, status, terms, legacy_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studioId,
        clientId,
        projectId,
        invoiceNumber,
        invoiceDate,
        billName,
        billCompany,
        billPhone,
        billEmail,
        projectScope,
        subtotal,
        discount,
        advance,
        total,
        status,
        terms,
        legacyId
      ]
    );

    const invoiceId = invResult.insertId;

    // 3. Insert Invoice Items
    for (const it of calculatedItems) {
      await connection.query(
        `INSERT INTO invoice_items 
         (invoice_id, description, quantity, unit_price, amount, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, it.description, it.quantity, it.unitPrice, it.amount, it.sortOrder]
      );
    }

    await connection.commit();

    return exports.getInvoice(studioId, invoiceId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Update an existing invoice
 */
exports.updateInvoice = async (studioId, identifier, data) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const isNumeric = /^\d+$/.test(String(identifier));
    const whereClause = isNumeric
      ? `(id = ? OR invoice_number = ?)`
      : `invoice_number = ?`;
    const params = isNumeric ? [identifier, identifier, studioId] : [identifier, studioId];

    const [existing] = await connection.query(
      `SELECT * FROM invoices WHERE ${whereClause} AND studio_id = ?`,
      params
    );

    if (!existing || existing.length === 0) {
      throw new Error('Invoice not found');
    }

    const prev = existing[0];
    const invoiceId = prev.id;

    const invoiceDate = data.date || data.invoiceDate || prev.invoice_date;
    const billName = data.billName !== undefined ? data.billName : prev.bill_name;
    const billCompany = data.billCompany !== undefined ? data.billCompany : prev.bill_company;
    const billPhone = data.billPhone !== undefined ? data.billPhone : prev.bill_phone;
    const billEmail = data.billEmail !== undefined ? data.billEmail : prev.bill_email;
    const projectScope =
      data.project !== undefined
        ? data.project
        : data.projectScope !== undefined
        ? data.projectScope
        : prev.project_scope;
    const discount = data.discount !== undefined ? parseFloat(data.discount) || 0 : prev.discount;
    const advance = data.advance !== undefined ? parseFloat(data.advance) || 0 : prev.advance;
    const terms = data.terms !== undefined ? data.terms : prev.terms;
    const status = data.status !== undefined ? data.status : prev.status;

    let subtotal = prev.subtotal;
    let total = prev.total;

    // Replace items if provided
    if (Array.isArray(data.items)) {
      await connection.query(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);

      subtotal = 0;
      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        const qty = parseFloat(item.qty || item.quantity) || 1;
        const price = parseFloat(item.price || item.unitPrice) || 0;
        const amount = qty * price;
        subtotal += amount;

        await connection.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [invoiceId, item.description || '', qty, price, amount, idx]
        );
      }

      total = Math.max(0, subtotal - discount - advance);
    } else if (data.discount !== undefined || data.advance !== undefined) {
      total = Math.max(0, subtotal - discount - advance);
    }

    await connection.query(
      `UPDATE invoices 
       SET invoice_date = ?, bill_name = ?, bill_company = ?, bill_phone = ?, bill_email = ?,
           project_scope = ?, subtotal = ?, discount = ?, advance = ?, total = ?, status = ?,
           terms = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        invoiceDate,
        billName,
        billCompany,
        billPhone,
        billEmail,
        projectScope,
        subtotal,
        discount,
        advance,
        total,
        status,
        terms,
        invoiceId
      ]
    );

    await connection.commit();
    return exports.getInvoice(studioId, invoiceId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Delete an invoice
 */
exports.deleteInvoice = async (studioId, identifier) => {
  const isNumeric = /^\d+$/.test(String(identifier));
  const whereClause = isNumeric
    ? `(id = ? OR invoice_number = ?)`
    : `invoice_number = ?`;
  const params = isNumeric ? [identifier, identifier, studioId] : [identifier, studioId];

  const [existing] = await query(
    `SELECT id, invoice_number FROM invoices WHERE ${whereClause} AND studio_id = ?`,
    params
  );
  if (!existing || existing.length === 0) {
    throw new Error('Invoice not found');
  }

  const invoice = existing[0];
  await query(`DELETE FROM invoices WHERE id = ?`, [invoice.id]);

  return { id: invoice.id, invoiceNumber: invoice.invoice_number };
};
