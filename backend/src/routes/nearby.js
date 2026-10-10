const express = require('express');
const router = express.Router();
const db = require('../database');
const { findNearbySurplus } = require('../services/recommender');

// GET /api/nearby-stock?phc_id=&medicine_id=&radius=
router.get('/', (req, res) => {
  const { phc_id, medicine_id, radius = 45 } = req.query;

  if (!phc_id || !medicine_id) {
    return res.status(400).json({ error: 'phc_id and medicine_id query parameters are required' });
  }

  let targetPhcId = phc_id;
  let phc = db.prepare('SELECT id FROM phcs WHERE id = ?').get(targetPhcId);
  if (!phc) {
    phc = db.prepare('SELECT id FROM phcs WHERE id = ? OR name LIKE ?').get(targetPhcId.replace('phc_', 'phc_cpt_'), `%${targetPhcId}%`);
    if (phc) targetPhcId = phc.id;
  }
  if (!phc) {
    return res.status(404).json({ error: `PHC '${phc_id}' not found` });
  }

  try {
    const data = findNearbySurplus(db, targetPhcId, [medicine_id], parseFloat(radius));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nearby-stock/multi (Multi-medicine bundle search)
router.post('/multi', (req, res) => {
  const { phc_id, medicine_ids, radius = 45 } = req.body;

  if (!phc_id || !medicine_ids || !Array.isArray(medicine_ids) || medicine_ids.length === 0) {
    return res.status(400).json({ error: 'phc_id and an array of medicine_ids are required' });
  }

  try {
    const data = findNearbySurplus(db, phc_id, medicine_ids, parseFloat(radius));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
