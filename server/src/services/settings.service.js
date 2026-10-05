const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Get studio settings
 */
exports.getSettings = async (studioId) => {
  const [rows] = await query(
    `SELECT s.id as studio_id, s.name as studio_name,
            ss.company_name, ss.address, ss.phone, ss.email, ss.currency, ss.logo_url, ss.default_terms,
            ss.updated_at
     FROM studios s
     LEFT JOIN studio_settings ss ON ss.studio_id = s.id
     WHERE s.id = ? LIMIT 1`,
    [studioId]
  );

  if (!rows || rows.length === 0) {
    throw new Error('Studio not found');
  }

  const s = rows[0];
  return {
    studioId: s.studio_id,
    studioName: s.studio_name,
    companyName: s.company_name || s.studio_name || 'Luminav Films',
    companyAddress: s.address || '',
    companyPhone: s.phone || '',
    companyEmail: s.email || '',
    currency: s.currency || '₹',
    logoUrl: s.logo_url || '',
    terms: s.default_terms || '',
    updatedAt: s.updated_at
  };
};

/**
 * Update studio settings
 */
exports.updateSettings = async (studioId, data) => {
  const {
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    currency,
    terms,
    studioName
  } = data;

  if (studioName) {
    await query(`UPDATE studios SET name = ? WHERE id = ?`, [studioName, studioId]);
  }

  const [existing] = await query(
    `SELECT id FROM studio_settings WHERE studio_id = ?`,
    [studioId]
  );

  if (existing.length === 0) {
    await query(
      `INSERT INTO studio_settings (studio_id, company_name, address, phone, email, currency, default_terms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        studioId,
        companyName || '',
        companyAddress || '',
        companyPhone || '',
        companyEmail || '',
        currency || '₹',
        terms || ''
      ]
    );
  } else {
    await query(
      `UPDATE studio_settings 
       SET company_name = COALESCE(?, company_name),
           address = COALESCE(?, address),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           currency = COALESCE(?, currency),
           default_terms = COALESCE(?, default_terms),
           updated_at = CURRENT_TIMESTAMP
       WHERE studio_id = ?`,
      [companyName, companyAddress, companyPhone, companyEmail, currency, terms, studioId]
    );
  }

  return exports.getSettings(studioId);
};

/**
 * Save logo file URL to studio settings
 */
exports.updateLogo = async (studioId, filename) => {
  const logoUrl = `/uploads/logos/${filename}`;
  await query(
    `UPDATE studio_settings SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE studio_id = ?`,
    [logoUrl, studioId]
  );
  return { logoUrl };
};

/**
 * Remove studio logo
 */
exports.deleteLogo = async (studioId) => {
  const [rows] = await query(
    `SELECT logo_url FROM studio_settings WHERE studio_id = ?`,
    [studioId]
  );
  if (rows.length > 0 && rows[0].logo_url) {
    const filename = path.basename(rows[0].logo_url);
    const filePath = path.join(__dirname, '../../uploads/logos', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('Could not delete old logo file:', e.message);
      }
    }
  }

  await query(
    `UPDATE studio_settings SET logo_url = '', updated_at = CURRENT_TIMESTAMP WHERE studio_id = ?`,
    [studioId]
  );
  return { logoUrl: '' };
};

/**
 * Reset monthly invoice sequence counter
 */
exports.resetSequence = async (studioId, yearMonth) => {
  const ym = yearMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  await query(
    `UPDATE invoice_sequences SET last_seq = 0 WHERE studio_id = ? AND \`year_month\` = ?`,
    [studioId, ym]
  );
  return { yearMonth: ym, lastSeq: 0 };
};
