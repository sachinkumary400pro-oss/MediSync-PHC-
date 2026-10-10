const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'medisync.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS districts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'Tamil Nadu'
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      district_id TEXT NOT NULL,
      FOREIGN KEY (district_id) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS phcs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      block_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      population_served INTEGER NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      medical_officer_name TEXT,
      pharmacist_name TEXT,
      FOREIGN KEY (block_id) REFERENCES blocks(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'pharmacist', 'medical_officer', 'block_medical_officer', 'district_admin'
      phc_id TEXT,
      block_id TEXT,
      district_id TEXT,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phc_id) REFERENCES phcs(id),
      FOREIGN KEY (block_id) REFERENCES blocks(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      form TEXT NOT NULL, -- 'Tablet', 'Syrup', 'Vial', 'Capsule', 'Suspension', 'Ointment'
      strength TEXT NOT NULL,
      category TEXT NOT NULL, -- 'Analgesic', 'Antibiotic', 'Maternal & Child Health', 'NCD / Chronic', 'Emergency / Antidote', 'Vaccine', 'Fluid & Electrolyte'
      unit TEXT NOT NULL, -- 'strip', 'bottle', 'vial', 'sachet'
      cold_chain INTEGER NOT NULL DEFAULT 0, -- 1 for cold-chain required (2-8°C)
      critical INTEGER NOT NULL DEFAULT 0, -- 1 for life-saving / critical
      min_threshold_days INTEGER NOT NULL DEFAULT 15,
      emergency_buffer_days INTEGER NOT NULL DEFAULT 30,
      seasonal_sensitivity TEXT DEFAULT 'normal' -- 'monsoon_surge', 'summer_gastro', 'vector_borne', 'normal'
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      phc_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date DATE NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      supplier_source TEXT DEFAULT 'TNMSC Warehouse',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phc_id) REFERENCES phcs(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    );

    CREATE TABLE IF NOT EXISTS stock_entries (
      id TEXT PRIMARY KEY,
      phc_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      batch_id TEXT,
      entry_date DATE NOT NULL,
      opening_stock INTEGER NOT NULL,
      received_qty INTEGER NOT NULL DEFAULT 0,
      issued_qty INTEGER NOT NULL DEFAULT 0,
      closing_stock INTEGER NOT NULL,
      remarks TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phc_id) REFERENCES phcs(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS transfer_requests (
      id TEXT PRIMARY KEY,
      request_number TEXT UNIQUE NOT NULL,
      from_phc_id TEXT NOT NULL, -- source donor PHC
      to_phc_id TEXT NOT NULL,   -- requester receiving PHC
      status TEXT NOT NULL DEFAULT 'requested', -- 'requested', 'approved', 'in_transit', 'received', 'rejected', 'completed'
      urgency TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'critical', 'emergency'
      notes TEXT,
      cold_chain_verified INTEGER DEFAULT 0,
      distance_km REAL,
      created_by TEXT NOT NULL,
      approved_by TEXT,
      received_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_phc_id) REFERENCES phcs(id),
      FOREIGN KEY (to_phc_id) REFERENCES phcs(id)
    );

    CREATE TABLE IF NOT EXISTS transfer_items (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      batch_id TEXT,
      requested_qty INTEGER NOT NULL,
      approved_qty INTEGER,
      received_qty INTEGER,
      FOREIGN KEY (transfer_id) REFERENCES transfer_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS emergency_indents (
      id TEXT PRIMARY KEY,
      indent_number TEXT UNIQUE NOT NULL,
      phc_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'dispatched', 'fulfilled', 'rejected'
      reason TEXT NOT NULL,
      total_items INTEGER NOT NULL DEFAULT 0,
      auto_drafted INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      approved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (phc_id) REFERENCES phcs(id)
    );

    CREATE TABLE IF NOT EXISTS emergency_indent_items (
      id TEXT PRIMARY KEY,
      indent_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      requested_qty INTEGER NOT NULL,
      approved_qty INTEGER,
      justification TEXT,
      FOREIGN KEY (indent_id) REFERENCES emergency_indents(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      phc_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      alert_type TEXT NOT NULL, -- 'low_stock', 'stockout', 'near_expiry', 'anomaly_spike', 'monsoon_surge'
      severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', -- 'new', 'acknowledged', 'resolved'
      acknowledged_by TEXT,
      resolved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (phc_id) REFERENCES phcs(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_phone TEXT NOT NULL,
      recipient_role TEXT NOT NULL,
      channel TEXT NOT NULL, -- 'SMS', 'WHATSAPP'
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    );

    -- Indexes for high-performance querying
    CREATE INDEX IF NOT EXISTS idx_stock_entries_phc_date ON stock_entries(phc_id, entry_date);
    CREATE INDEX IF NOT EXISTS idx_stock_entries_med ON stock_entries(medicine_id);
    CREATE INDEX IF NOT EXISTS idx_batches_phc_med ON batches(phc_id, medicine_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_phc_status ON alerts(phc_id, status);
    CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfer_requests(status);
  `;

  db.exec(schema);
  console.log('Database initialized with schema successfully.');
}

initDatabase();

module.exports = db;
