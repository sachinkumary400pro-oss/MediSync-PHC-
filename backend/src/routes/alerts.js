const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/alerts?phc_id=&status=
router.get('/', (req, res) => {
  const { phc_id, status } = req.query;
  let query = `
    SELECT a.*, p.name as phc_name, m.name as medicine_name, m.unit, m.form, m.critical, m.cold_chain
    FROM alerts a
    JOIN phcs p ON a.phc_id = p.id
    JOIN medicines m ON a.medicine_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (phc_id) {
    query += ' AND a.phc_id = ?';
    params.push(phc_id);
  }
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }
  query += " ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, a.created_at DESC";

  const alerts = db.prepare(query).all(...params);
  res.json({ alerts });
});

// PATCH /api/alerts/:id (acknowledge or resolve)
router.patch('/:id', authenticateToken, (req, res) => {
  const { status } = req.body; // 'acknowledged', 'resolved'
  if (!['acknowledged', 'resolved', 'new'].includes(status)) {
    return res.status(400).json({ error: 'Invalid alert status' });
  }

  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  let ackBy = alert.acknowledged_by;
  let resBy = alert.resolved_by;
  let resAt = alert.resolved_at;

  if (status === 'acknowledged') ackBy = req.user.full_name;
  if (status === 'resolved') {
    resBy = req.user.full_name;
    resAt = new Date().toISOString();
  }

  db.prepare(`
    UPDATE alerts
    SET status = ?, acknowledged_by = ?, resolved_by = ?, resolved_at = ?
    WHERE id = ?
  `).run(status, ackBy, resBy, resAt, alert.id);

  res.json({ success: true, message: `Alert updated to ${status}` });
});

module.exports = router;
