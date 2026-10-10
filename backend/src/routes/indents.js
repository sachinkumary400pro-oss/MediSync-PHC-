const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { calculateConsumptionMetrics } = require('../services/forecasting');

// GET /api/indents?phc_id=
router.get('/', (req, res) => {
  const { phc_id, status } = req.query;
  let query = `
    SELECT ei.*, p.name as phc_name, p.phone as phc_phone
    FROM emergency_indents ei
    JOIN phcs p ON ei.phc_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (phc_id) {
    query += ' AND ei.phc_id = ?';
    params.push(phc_id);
  }
  if (status) {
    query += ' AND ei.status = ?';
    params.push(status);
  }
  query += ' ORDER BY ei.created_at DESC';

  const indents = db.prepare(query).all(...params);

  for (const ind of indents) {
    ind.items = db.prepare(`
      SELECT eii.*, m.name as medicine_name, m.code as medicine_code, m.unit, m.form, m.critical, m.cold_chain
      FROM emergency_indent_items eii
      JOIN medicines m ON eii.medicine_id = m.id
      WHERE eii.indent_id = ?
    `).all(ind.id);
  }

  res.json({ indents });
});

// POST /api/indents (Create emergency indent)
router.post('/', authenticateToken, (req, res) => {
  const { phc_id, reason, items } = req.body;

  if (!phc_id || !reason || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'PHC, justification reason, and items are required' });
  }

  const id = `ind_${Date.now()}`;
  const count = db.prepare('SELECT COUNT(*) as count FROM emergency_indents').get().count + 1;
  const indentNumber = `EI-2026-TNMSC-${String(count).padStart(3, '0')}`;

  db.prepare(`
    INSERT INTO emergency_indents (id, indent_number, phc_id, status, reason, total_items, auto_drafted, created_by)
    VALUES (?, ?, ?, 'submitted', ?, ?, 0, ?)
  `).run(id, indentNumber, phc_id, reason, items.length, req.user.full_name);

  const insertItem = db.prepare(`
    INSERT INTO emergency_indent_items (id, indent_id, medicine_id, requested_qty, justification)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < items.length; i++) {
    insertItem.run(`eii_${id}_${i}`, id, items[i].medicine_id, items[i].requested_qty, items[i].justification || 'Emergency stock depletion');
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, 'CREATE_INDENT', 'emergency_indents', ?, ?)
  `).run(`aud_${Date.now()}`, req.user.id, id, `Created emergency indent ${indentNumber}`);

  res.status(201).json({
    id,
    indent_number: indentNumber,
    message: 'Emergency indent submitted to District Medical Store'
  });
});

// POST /api/indents/auto-draft (AI generated auto-drafted indent for critical shortages)
router.post('/auto-draft', authenticateToken, (req, res) => {
  const { phc_id } = req.body;
  if (!phc_id) return res.status(400).json({ error: 'phc_id is required' });

  const phc = db.prepare('SELECT * FROM phcs WHERE id = ?').get(phc_id);
  if (!phc) return res.status(404).json({ error: 'PHC not found' });

  const medicines = db.prepare('SELECT id, name, unit, critical FROM medicines').all();
  const criticalShortages = [];

  for (const m of medicines) {
    const metrics = calculateConsumptionMetrics(db, phc_id, m.id);
    if (metrics && (metrics.status === 'out_of_stock' || metrics.days_left < metrics.min_threshold)) {
      // Smart indent formula: 45 days normal buffer + population factor
      const popFactor = Math.max(1, phc.population_served / 30000);
      const suggestedQty = Math.ceil(Math.max(50, metrics.effective_daily_rate * 45 * popFactor));

      criticalShortages.push({
        medicine_id: m.id,
        medicine_name: m.name,
        unit: m.unit,
        current_stock: metrics.current_stock,
        days_left: metrics.days_left,
        effective_daily_rate: metrics.effective_daily_rate,
        requested_qty: suggestedQty,
        justification: `AI Recommendation: Stock at ${metrics.current_stock} ${metrics.unit} (${metrics.days_left} days left). Scaled for ${phc.population_served.toLocaleString()} served population.`
      });
    }
  }

  if (criticalShortages.length === 0) {
    return res.json({ message: 'No critical shortages detected. Emergency indent not required at this time.', drafted: null });
  }

  const id = `ind_auto_${Date.now()}`;
  const count = db.prepare('SELECT COUNT(*) as count FROM emergency_indents').get().count + 1;
  const indentNumber = `EI-2026-TNMSC-${String(count).padStart(3, '0')}`;

  db.prepare(`
    INSERT INTO emergency_indents (id, indent_number, phc_id, status, reason, total_items, auto_drafted, created_by)
    VALUES (?, ?, ?, 'draft', 'Auto-drafted by MediSync AI engine based on critical days-of-stock shortages.', ?, 1, 'MediSync AI Engine')
  `).run(id, indentNumber, phc_id, criticalShortages.length);

  const insertItem = db.prepare(`
    INSERT INTO emergency_indent_items (id, indent_id, medicine_id, requested_qty, justification)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < criticalShortages.length; i++) {
    const itm = criticalShortages[i];
    insertItem.run(`eii_${id}_${i}`, id, itm.medicine_id, itm.requested_qty, itm.justification);
  }

  res.json({
    success: true,
    drafted: {
      id,
      indent_number: indentNumber,
      phc_name: phc.name,
      items: criticalShortages
    }
  });
});

// PATCH /api/indents/:id/status
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { status, approved_by } = req.body;
  const indent = db.prepare('SELECT * FROM emergency_indents WHERE id = ?').get(req.params.id);
  if (!indent) return res.status(404).json({ error: 'Indent not found' });

  db.prepare(`
    UPDATE emergency_indents
    SET status = ?, approved_by = COALESCE(?, approved_by), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, approved_by || req.user.full_name, indent.id);

  res.json({ success: true, message: `Indent updated to ${status}` });
});

module.exports = router;
