const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculateConsumptionMetrics } = require('../services/forecasting');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../services/notification');

// GET /api/stock?phc_id=
router.get('/', (req, res) => {
  const phcId = req.query.phc_id;
  if (!phcId) {
    return res.status(400).json({ error: 'phc_id query parameter is required' });
  }

  const medicines = db.prepare('SELECT id FROM medicines ORDER BY critical DESC, name ASC').all();
  const stockList = [];

  for (const m of medicines) {
    const metrics = calculateConsumptionMetrics(db, phcId, m.id);
    if (metrics) {
      stockList.push(metrics);
    }
  }

  res.json({ phc_id: phcId, stock: stockList });
});

// GET /api/stock/days-left?phc_id=
router.get('/days-left', (req, res) => {
  const phcId = req.query.phc_id;
  if (!phcId) return res.status(400).json({ error: 'phc_id parameter required' });

  const medicines = db.prepare('SELECT id FROM medicines').all();
  const list = [];
  for (const m of medicines) {
    const metrics = calculateConsumptionMetrics(db, phcId, m.id);
    if (metrics) list.push(metrics);
  }

  // Sort by days_left ascending (stockouts and critical shortages at the top)
  list.sort((a, b) => {
    if (a.current_stock === 0 && b.current_stock !== 0) return -1;
    if (b.current_stock === 0 && a.current_stock !== 0) return 1;
    return a.days_left - b.days_left;
  });

  res.json({
    phc_id: phcId,
    critical_count: list.filter(s => s.status === 'critical' || s.status === 'out_of_stock').length,
    low_count: list.filter(s => s.status === 'low').length,
    adequate_count: list.filter(s => s.status === 'normal' || s.status === 'surplus').length,
    items: list
  });
});

// GET /api/stock/history?phc_id=&medicine_id=&days=
router.get('/history', (req, res) => {
  const { phc_id, medicine_id, days = 30 } = req.query;
  if (!phc_id || !medicine_id) {
    return res.status(400).json({ error: 'phc_id and medicine_id are required' });
  }

  const entries = db.prepare(`
    SELECT entry_date, opening_stock, received_qty, issued_qty, closing_stock, remarks
    FROM stock_entries
    WHERE phc_id = ? AND medicine_id = ?
    ORDER BY entry_date DESC
    LIMIT ?
  `).all(phc_id, medicine_id, parseInt(days));

  // Reverse so chronological order (oldest to newest) for chart plotting
  res.json({ history: entries.reverse() });
});

// GET /api/stock/batches?phc_id=&medicine_id=
router.get('/batches', (req, res) => {
  const { phc_id, medicine_id } = req.query;
  if (!phc_id) return res.status(400).json({ error: 'phc_id is required' });

  let query = 'SELECT b.*, m.name as medicine_name, m.unit FROM batches b JOIN medicines m ON b.medicine_id = m.id WHERE b.phc_id = ?';
  const params = [phc_id];
  if (medicine_id) {
    query += ' AND b.medicine_id = ?';
    params.push(medicine_id);
  }
  query += ' ORDER BY b.expiry_date ASC';

  const batches = db.prepare(query).all(...params);
  res.json({ batches });
});

// POST /api/stock/entry (Daily stock entry)
router.post('/entry', authenticateToken, (req, res) => {
  const { phc_id, medicine_id, batch_number, expiry_date, opening_stock, received_qty, issued_qty, closing_stock, remarks } = req.body;

  if (!phc_id || !medicine_id || closing_stock === undefined) {
    return res.status(400).json({ error: 'Missing required stock entry fields' });
  }

  const entryDate = req.body.entry_date || new Date().toISOString().split('T')[0];
  const user = req.user;

  // Find or create batch
  let batchId = null;
  if (batch_number) {
    let existingBatch = db.prepare('SELECT id FROM batches WHERE phc_id = ? AND medicine_id = ? AND batch_number = ?').get(phc_id, medicine_id, batch_number);
    if (existingBatch) {
      batchId = existingBatch.id;
      db.prepare('UPDATE batches SET quantity = ?, expiry_date = COALESCE(?, expiry_date) WHERE id = ?')
        .run(closing_stock, expiry_date, batchId);
    } else {
      batchId = `b_${Date.now()}`;
      db.prepare(`
        INSERT INTO batches (id, phc_id, medicine_id, batch_number, expiry_date, quantity, supplier_source)
        VALUES (?, ?, ?, ?, ?, ?, 'Routine Entry')
      `).run(batchId, phc_id, medicine_id, batch_number, expiry_date || '2028-12-31', closing_stock);
    }
  } else {
    // Pick first active batch or update it
    let batch = db.prepare('SELECT id FROM batches WHERE phc_id = ? AND medicine_id = ? ORDER BY expiry_date ASC LIMIT 1').get(phc_id, medicine_id);
    if (batch) {
      batchId = batch.id;
      db.prepare('UPDATE batches SET quantity = ? WHERE id = ?').run(closing_stock, batchId);
    }
  }

  // Insert stock entry
  const entryId = `se_${Date.now()}`;
  db.prepare(`
    INSERT INTO stock_entries (id, phc_id, medicine_id, batch_id, entry_date, opening_stock, received_qty, issued_qty, closing_stock, remarks, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryId,
    phc_id,
    medicine_id,
    batchId,
    entryDate,
    opening_stock || closing_stock,
    received_qty || 0,
    issued_qty || 0,
    closing_stock,
    remarks || '',
    user.full_name
  );

  // Calculate updated metrics to check for alert triggering
  const metrics = calculateConsumptionMetrics(db, phc_id, medicine_id);
  let generatedAlert = null;

  if (metrics) {
    if (metrics.current_stock === 0) {
      const alertId = `alt_${Date.now()}`;
      db.prepare(`
        INSERT INTO alerts (id, phc_id, medicine_id, alert_type, severity, title, message, status)
        VALUES (?, ?, ?, 'stockout', 'critical', ?, ?, 'new')
      `).run(
        alertId, phc_id, medicine_id,
        `Stock-out: ${metrics.medicine_name}`,
        `Stock has dropped to ZERO units at this PHC. Immediate transfer or indent recommended.`
      );
      generatedAlert = 'STOCKOUT_ALERT';

      // Send mock SMS/WhatsApp
      const phc = db.prepare('SELECT phone, name FROM phcs WHERE id = ?').get(phc_id);
      if (phc) {
        sendNotification(db, {
          recipientPhone: phc.phone,
          recipientRole: 'Medical Officer',
          channel: 'WHATSAPP',
          message: `🚨 CRITICAL STOCK-OUT ALERT: ${metrics.medicine_name} is at 0 units at ${phc.name}. MediSync automated nearby finder has identified donor candidates.`
        });
      }
    } else if (metrics.days_left < metrics.min_threshold) {
      const alertId = `alt_${Date.now()}`;
      db.prepare(`
        INSERT INTO alerts (id, phc_id, medicine_id, alert_type, severity, title, message, status)
        VALUES (?, ?, ?, 'low_stock', 'high', ?, ?, 'new')
      `).run(
        alertId, phc_id, medicine_id,
        `Low Stock: ${metrics.medicine_name}`,
        `Only ${metrics.days_left} days of stock remaining (${metrics.current_stock} ${metrics.unit}). Critical threshold is ${metrics.min_threshold} days.`
      );
      generatedAlert = 'LOW_STOCK_ALERT';
    }
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, 'STOCK_ENTRY', 'stock_entries', ?, ?)
  `).run(`aud_${Date.now()}`, user.id, entryId, `Stock entry: ${closing_stock} closing for med ${medicine_id} by ${user.username}`);

  res.json({
    success: true,
    entry_id: entryId,
    metrics,
    generated_alert: generatedAlert
  });
});

module.exports = router;
