const { query, getConnection } = require('../config/database');
const projectService = require('./project.service');
const invoiceService = require('./invoice.service');
const clientService = require('./client.service');
const settingsService = require('./settings.service');

/**
 * Export full studio data in JSON format
 */
exports.exportStudioBackup = async (studioId) => {
  const [projects, invoices, clients, settings] = await Promise.all([
    projectService.listProjects(studioId),
    invoiceService.listInvoices(studioId),
    clientService.listClients(studioId, {}),
    settingsService.getSettings(studioId)
  ]);

  // Build legacy format invoicesData map for backward compatibility
  const invoicesData = {
    settings: JSON.stringify({
      currency: settings.currency,
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyPhone: settings.companyPhone,
      companyEmail: settings.companyEmail,
      logoDataUrl: '',
      terms: settings.terms
    }),
    'invoice-history': JSON.stringify(
      invoices.map((inv) => ({
        id: inv.invoiceNumber,
        dateIso: inv.date,
        dateDisplay: inv.date,
        billName: inv.billName,
        project: inv.projectScope,
        total: inv.total,
        savedAt: inv.savedAt
      }))
    )
  };

  invoices.forEach((inv) => {
    invoicesData[`invoice:${inv.invoiceNumber}`] = JSON.stringify({
      id: inv.invoiceNumber,
      date: inv.date,
      billName: inv.billName,
      billCompany: inv.billCompany,
      billPhone: inv.billPhone,
      billEmail: inv.billEmail,
      project: inv.projectScope,
      items: inv.items.map((it) => ({
        key: it.key,
        description: it.description,
        qty: it.qty,
        price: it.price
      })),
      discount: inv.discount,
      advance: inv.advance
    });
  });

  return {
    app: 'luminosity-studio-suite',
    version: 7,
    exportedAt: new Date().toISOString(),
    projects,
    shoots: projects, // Backwards compatibility alias
    clients,
    invoices,
    settings,
    invoicesData,
    data: invoicesData
  };
};

/**
 * Import JSON backup (supports Version 5, 6, and 7 formats)
 */
exports.importStudioBackup = async (studioId, payload, mode = 'merge') => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const isReplace = mode === 'replace';
    if (isReplace) {
      // Clear current studio records safely
      await connection.query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE studio_id = ?)', [studioId]);
      await connection.query('DELETE FROM invoices WHERE studio_id = ?', [studioId]);
      await connection.query('DELETE FROM payments WHERE project_id IN (SELECT id FROM projects WHERE studio_id = ?)', [studioId]);
      await connection.query('DELETE FROM expenses WHERE project_id IN (SELECT id FROM projects WHERE studio_id = ?)', [studioId]);
      await connection.query('DELETE FROM projects WHERE studio_id = ?', [studioId]);
      await connection.query('DELETE FROM clients WHERE studio_id = ?', [studioId]);
    }

    let importedProjectsCount = 0;
    let importedInvoicesCount = 0;

    // 1. Import Projects
    const projectsList = Array.isArray(payload)
      ? payload
      : payload.projects || payload.shoots || [];

    for (const p of projectsList) {
      const title = p.title || 'Untitled Project';
      const description = p.deliverables || p.description || '';
      const status = p.status || 'upcoming';
      const startDate = p.startDate || null;
      const endDate = p.endDate || startDate || null;
      const budget = parseFloat(p.payment || p.budget) || 0;
      const legacyId = p.id || null;

      // Extract client name from title heuristic if format is "Client - Shoot"
      let clientName = title;
      if (title.includes(' - ')) {
        clientName = title.split(' - ')[0].trim();
      }

      // Check or create client
      let clientId = null;
      const [existingClient] = await connection.query(
        'SELECT id FROM clients WHERE studio_id = ? AND LOWER(name) = LOWER(?) LIMIT 1',
        [studioId, clientName]
      );
      if (existingClient.length > 0) {
        clientId = existingClient[0].id;
      } else {
        const [newClient] = await connection.query(
          'INSERT INTO clients (studio_id, name) VALUES (?, ?)',
          [studioId, clientName]
        );
        clientId = newClient.insertId;
      }

      const [projResult] = await connection.query(
        `INSERT INTO projects (studio_id, client_id, title, description, status, start_date, end_date, budget, legacy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studioId, clientId, title, description, status, startDate, endDate, budget, legacyId]
      );
      const newProjectId = projResult.insertId;
      importedProjectsCount++;

      // Expenses
      const expenseItems = p.expenseItems || [];
      for (const e of expenseItems) {
        const amt = parseFloat(e.amount) || 0;
        if (amt > 0 || e.title) {
          await connection.query(
            `INSERT INTO expenses (project_id, category, description, amount, expense_date)
             VALUES (?, ?, ?, ?, ?)`,
            [newProjectId, e.title || 'General Expense', '', amt, startDate]
          );
        }
      }

      // Payments
      const paymentRecords = p.paymentRecords || [];
      for (const py of paymentRecords) {
        const amt = parseFloat(py.amount) || 0;
        if (amt > 0) {
          await connection.query(
            `INSERT INTO payments (project_id, amount, payment_date, method, reference, notes, legacy_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              newProjectId,
              amt,
              py.date || startDate || new Date().toISOString().slice(0, 10),
              py.method || 'UPI',
              py.note || '',
              '',
              py.id || null
            ]
          );
        }
      }
    }

    // 2. Import Invoices
    const rawInvoicesData = payload.invoicesData || payload.data;
    if (rawInvoicesData && typeof rawInvoicesData === 'object') {
      for (const [key, value] of Object.entries(rawInvoicesData)) {
        if (key.startsWith('invoice:') && key !== 'invoice:draft') {
          try {
            const inv = typeof value === 'string' ? JSON.parse(value) : value;
            const invoiceNumber = inv.id;
            const invoiceDate = inv.date || new Date().toISOString().slice(0, 10);
            const billName = inv.billName || '';
            const billCompany = inv.billCompany || '';
            const billPhone = inv.billPhone || '';
            const billEmail = inv.billEmail || '';
            const projectScope = inv.project || '';
            const discount = parseFloat(inv.discount) || 0;
            const advance = parseFloat(inv.advance) || 0;

            const items = Array.isArray(inv.items) ? inv.items : [];
            let subtotal = 0;
            const calcItems = items.map((it, idx) => {
              const qty = parseFloat(it.qty) || 1;
              const price = parseFloat(it.price) || 0;
              const amt = qty * price;
              subtotal += amt;
              return { description: it.description || '', qty, price, amt, idx };
            });

            const total = Math.max(0, subtotal - discount - advance);

            // Insert invoice if not already existing
            const [existingInv] = await connection.query(
              'SELECT id FROM invoices WHERE studio_id = ? AND invoice_number = ?',
              [studioId, invoiceNumber]
            );

            let invoiceId;
            if (existingInv.length > 0) {
              if (isReplace) {
                invoiceId = existingInv[0].id;
              } else {
                continue; // Skip duplicate on merge
              }
            } else {
              const [invResult] = await connection.query(
                `INSERT INTO invoices 
                 (studio_id, invoice_number, invoice_date, bill_name, bill_company, bill_phone, bill_email, project_scope, subtotal, discount, advance, total, status, legacy_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)`,
                [
                  studioId,
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
                  invoiceNumber
                ]
              );
              invoiceId = invResult.insertId;
              importedInvoicesCount++;
            }

            for (const it of calcItems) {
              await connection.query(
                `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [invoiceId, it.description, it.qty, it.price, it.amt, it.idx]
              );
            }
          } catch (e) {
            console.warn('Error importing invoice item:', e.message);
          }
        }
      }
    }

    // 3. Import Settings if present
    if (rawInvoicesData?.settings) {
      try {
        const s = typeof rawInvoicesData.settings === 'string' ? JSON.parse(rawInvoicesData.settings) : rawInvoicesData.settings;
        await connection.query(
          `UPDATE studio_settings 
           SET company_name = COALESCE(?, company_name),
               address = COALESCE(?, address),
               phone = COALESCE(?, phone),
               email = COALESCE(?, email),
               currency = COALESCE(?, currency),
               default_terms = COALESCE(?, default_terms)
           WHERE studio_id = ?`,
          [s.companyName, s.companyAddress, s.companyPhone, s.companyEmail, s.currency, s.terms, studioId]
        );
      } catch (e) {
        console.warn('Could not parse settings:', e.message);
      }
    }

    await connection.commit();

    return {
      success: true,
      mode,
      importedProjectsCount,
      importedInvoicesCount
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};
