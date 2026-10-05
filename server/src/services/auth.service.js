const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getConnection } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'luminosity_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 */
function generateToken(user, studioId) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      studioId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Register a new user with studio and default settings
 */
exports.register = async ({ email, password, name, studioName = 'Luminav Films' }) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Check if user already exists
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      throw new Error('A user with this email address already exists.');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, passwordHash, name, 'admin']
    );
    const userId = userResult.insertId;

    // Insert default studio
    const [studioResult] = await connection.query(
      'INSERT INTO studios (owner_id, name) VALUES (?, ?)',
      [userId, studioName]
    );
    const studioId = studioResult.insertId;

    // Insert default studio settings
    const defaultTerms =
      'All deliverables are provided as per the agreed project scope.\n' +
      'Any additional revisions or services beyond the agreed scope may be charged separately.\n' +
      'This invoice confirms that full payment has been received and the project has been successfully completed.';

    await connection.query(
      `INSERT INTO studio_settings 
       (studio_id, company_name, address, phone, email, currency, default_terms) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        studioId,
        studioName,
        'Godrej Garden City\nAhmedabad\n382470\ninfo@luminavfilms.com',
        '',
        email,
        '₹',
        defaultTerms
      ]
    );

    await connection.commit();

    const user = { id: userId, email, name, role: 'admin' };
    const token = generateToken(user, studioId);

    return {
      user,
      studio: { id: studioId, name: studioName },
      token
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Authenticate user with email and password
 */
exports.login = async ({ identifier, email, password }) => {
  const loginId = identifier || email;
  const [users] = await query(
    `SELECT u.id, u.email, u.password_hash, u.name, u.role, 
            s.id as studio_id, s.name as studio_name 
     FROM users u 
     LEFT JOIN studios s ON s.owner_id = u.id 
     WHERE u.email = ? OR u.name = ? LIMIT 1`,
    [loginId, loginId]
  );

  if (!users || users.length === 0) {
    throw new Error('Invalid email or password.');
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  const studioId = user.studio_id || 1;
  const token = generateToken(user, studioId);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    studio: {
      id: studioId,
      name: user.studio_name || 'Luminav Films'
    },
    token
  };
};

/**
 * Fetch profile by user ID
 */
exports.getProfile = async (userId) => {
  const [users] = await query(
    `SELECT u.id, u.email, u.name, u.role, u.created_at, 
            s.id as studio_id, s.name as studio_name 
     FROM users u 
     LEFT JOIN studios s ON s.owner_id = u.id 
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  if (!users || users.length === 0) {
    throw new Error('User not found');
  }

  const user = users[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.created_at,
    studio: {
      id: user.studio_id,
      name: user.studio_name
    }
  };
};

/**
 * Ensures at least one admin user exists on startup (Default admin: admin@luminavfilms.com / luminav2026)
 */
exports.ensureSeedAdmin = async () => {
  try {
    const [rows] = await query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      console.log('🌱 No users found. Seeding initial admin user...');
      await exports.register({
        email: 'admin@luminavfilms.com',
        password: 'luminav2026',
        name: 'Studio Admin',
        studioName: 'Luminav Films'
      });
      console.log('✅ Default admin seeded: admin@luminavfilms.com / luminav2026');
    }
  } catch (err) {
    console.warn('⚠️ Could not check or seed admin user:', err.message);
  }
};
