-- =====================================================
-- LUMINOSITY STUDIO SUITE — MySQL Database Schema
-- =====================================================

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'editor', 'viewer') DEFAULT 'admin',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. STUDIOS
CREATE TABLE IF NOT EXISTS studios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  owner_id      INT NOT NULL,
  name          VARCHAR(255) NOT NULL DEFAULT 'Luminav Films',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. STUDIO SETTINGS
CREATE TABLE IF NOT EXISTS studio_settings (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  studio_id       INT NOT NULL UNIQUE,
  company_name    VARCHAR(255) DEFAULT '',
  address         TEXT,
  phone           VARCHAR(50) DEFAULT '',
  email           VARCHAR(255) DEFAULT '',
  currency        VARCHAR(10) DEFAULT '₹',
  logo_url        VARCHAR(500) DEFAULT '',
  default_terms   TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  studio_id     INT NOT NULL,
  name          VARCHAR(255) NOT NULL,
  company       VARCHAR(255) DEFAULT '',
  phone         VARCHAR(50) DEFAULT '',
  email         VARCHAR(255) DEFAULT '',
  address       TEXT,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  INDEX idx_clients_studio (studio_id),
  INDEX idx_clients_name (name)
) ENGINE=InnoDB;

-- 5. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  studio_id     INT NOT NULL,
  client_id     INT DEFAULT NULL,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  status        ENUM('upcoming', 'ongoing', 'pending', 'completed') DEFAULT 'upcoming',
  start_date    DATE DEFAULT NULL,
  end_date      DATE DEFAULT NULL,
  budget        DECIMAL(12,2) DEFAULT 0.00,
  priority      ENUM('low', 'medium', 'high') DEFAULT 'medium',
  legacy_id     VARCHAR(100) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  INDEX idx_projects_studio (studio_id),
  INDEX idx_projects_status (status),
  INDEX idx_projects_client (client_id),
  INDEX idx_projects_dates (start_date, end_date)
) ENGINE=InnoDB;

-- 6. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  project_id    INT NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  payment_date  DATE NOT NULL,
  method        VARCHAR(50) DEFAULT 'UPI',
  reference     VARCHAR(255) DEFAULT '',
  notes         TEXT,
  legacy_id     VARCHAR(100) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_payments_project (project_id),
  INDEX idx_payments_date (payment_date)
) ENGINE=InnoDB;

-- 7. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  project_id    INT NOT NULL,
  category      VARCHAR(255) DEFAULT '',
  description   TEXT,
  amount        DECIMAL(12,2) NOT NULL,
  expense_date  DATE DEFAULT NULL,
  payment_method VARCHAR(50) DEFAULT '',
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_expenses_project (project_id)
) ENGINE=InnoDB;

-- 8. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  studio_id       INT NOT NULL,
  client_id       INT DEFAULT NULL,
  project_id      INT DEFAULT NULL,
  invoice_number  VARCHAR(50) NOT NULL UNIQUE,
  invoice_date    DATE NOT NULL,
  bill_name       VARCHAR(255) DEFAULT '',
  bill_company    VARCHAR(255) DEFAULT '',
  bill_phone      VARCHAR(50) DEFAULT '',
  bill_email      VARCHAR(255) DEFAULT '',
  project_scope   TEXT,
  subtotal        DECIMAL(12,2) DEFAULT 0.00,
  discount        DECIMAL(12,2) DEFAULT 0.00,
  advance         DECIMAL(12,2) DEFAULT 0.00,
  total           DECIMAL(12,2) DEFAULT 0.00,
  status          ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
  terms           TEXT,
  legacy_id       VARCHAR(100) DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  INDEX idx_invoices_studio (studio_id),
  INDEX idx_invoices_number (invoice_number),
  INDEX idx_invoices_date (invoice_date),
  INDEX idx_invoices_client (client_id)
) ENGINE=InnoDB;

-- 9. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id    INT NOT NULL,
  description   VARCHAR(500) DEFAULT '',
  quantity      DECIMAL(10,2) DEFAULT 1.00,
  unit_price    DECIMAL(12,2) DEFAULT 0.00,
  amount        DECIMAL(12,2) DEFAULT 0.00,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_items_invoice (invoice_id)
) ENGINE=InnoDB;

-- 10. INVOICE SEQUENCES
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  studio_id     INT NOT NULL,
  `year_month`  VARCHAR(7) NOT NULL,
  last_seq      INT DEFAULT 0,
  UNIQUE KEY uk_studio_month (studio_id, `year_month`),
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT DEFAULT NULL,
  studio_id     INT DEFAULT NULL,
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     INT DEFAULT NULL,
  old_value     JSON DEFAULT NULL,
  new_value     JSON DEFAULT NULL,
  ip_address    VARCHAR(45) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;
