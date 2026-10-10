const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/medicines
router.get('/', (req, res) => {
  const { category, search, critical, cold_chain } = req.query;
  let query = 'SELECT * FROM medicines WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (critical !== undefined) {
    query += ' AND critical = ?';
    params.push(critical === 'true' || critical === '1' ? 1 : 0);
  }
  if (cold_chain !== undefined) {
    query += ' AND cold_chain = ?';
    params.push(cold_chain === 'true' || cold_chain === '1' ? 1 : 0);
  }
  if (search) {
    query += ' AND (name LIKE ? OR generic_name LIKE ? OR code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY critical DESC, name ASC';
  const medicines = db.prepare(query).all(...params);

  // Get distinct categories
  const categories = db.prepare('SELECT DISTINCT category FROM medicines ORDER BY category').all().map(r => r.category);

  res.json({ medicines, categories });
});

// GET /api/medicines/:id
router.get('/:id', (req, res) => {
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
  if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
  res.json({ medicine });
});

// POST /api/medicines (Admin)
router.post('/', authenticateToken, authorizeRoles('district_admin'), (req, res) => {
  const { code, name, generic_name, form, strength, category, unit, cold_chain, critical, min_threshold_days, emergency_buffer_days, seasonal_sensitivity } = req.body;

  if (!code || !name || !form || !unit) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  const id = `med_${Date.now()}`;
  try {
    db.prepare(`
      INSERT INTO medicines (id, code, name, generic_name, form, strength, category, unit, cold_chain, critical, min_threshold_days, emergency_buffer_days, seasonal_sensitivity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, name, generic_name || name, form, strength || '', category || 'General', unit, cold_chain ? 1 : 0, critical ? 1 : 0, min_threshold_days || 15, emergency_buffer_days || 30, seasonal_sensitivity || 'normal');

    res.status(201).json({ id, message: 'Medicine added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/medicines/:id (Admin)
router.put('/:id', authenticateToken, authorizeRoles('district_admin'), (req, res) => {
  const { name, generic_name, min_threshold_days, emergency_buffer_days, critical, cold_chain } = req.body;
  try {
    db.prepare(`
      UPDATE medicines
      SET name = COALESCE(?, name),
          generic_name = COALESCE(?, generic_name),
          min_threshold_days = COALESCE(?, min_threshold_days),
          emergency_buffer_days = COALESCE(?, emergency_buffer_days),
          critical = COALESCE(?, critical),
          cold_chain = COALESCE(?, cold_chain)
      WHERE id = ?
    `).run(name, generic_name, min_threshold_days, emergency_buffer_days, critical, cold_chain, req.params.id);

    res.json({ message: 'Medicine updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
