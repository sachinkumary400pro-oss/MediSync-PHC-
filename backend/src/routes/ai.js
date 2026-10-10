const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculateConsumptionMetrics } = require('../services/forecasting');
const { detectAnomalies } = require('../services/anomaly');
const { getSeasonalProfile, calculateSeasonalAdjustedDemand } = require('../services/seasonal');
const { generateDistrictRedistributionPlan } = require('../services/recommender');
const { handleChatbotQuery } = require('../services/chatbot');

// GET /api/ai/forecast/:phc_id/:medicine_id
router.get('/forecast/:phc_id/:medicine_id', (req, res) => {
  const { phc_id, medicine_id } = req.params;

  const metrics = calculateConsumptionMetrics(db, phc_id, medicine_id);
  if (!metrics) return res.status(404).json({ error: 'Metrics could not be calculated' });

  // 30 days history for visualization
  const history = db.prepare(`
    SELECT entry_date, closing_stock, issued_qty
    FROM stock_entries
    WHERE phc_id = ? AND medicine_id = ?
    ORDER BY entry_date DESC LIMIT 30
  `).all(phc_id, medicine_id).reverse();

  // Project future 30 days depletion slope
  const projections = [];
  let simulatedStock = metrics.current_stock;
  const today = new Date();

  for (let i = 1; i <= 30; i++) {
    const projDate = new Date(today);
    projDate.setDate(projDate.getDate() + i);
    simulatedStock = Math.max(0, simulatedStock - metrics.effective_daily_rate);
    projections.push({
      day_offset: i,
      date: projDate.toISOString().split('T')[0],
      projected_stock: Math.round(simulatedStock)
    });
  }

  // Seasonal adjustment
  const seasonalInfo = calculateSeasonalAdjustedDemand(metrics.medicine_name, metrics.effective_daily_rate);

  res.json({
    metrics,
    history,
    projections,
    seasonal: seasonalInfo
  });
});

// GET /api/ai/anomalies
router.get('/anomalies', (req, res) => {
  const phcId = req.query.phc_id || null;
  const anomalies = detectAnomalies(db, phcId);
  res.json({ anomalies, count: anomalies.length });
});

// GET /api/ai/seasonal-profile
router.get('/seasonal-profile', (req, res) => {
  const profile = getSeasonalProfile();
  res.json({ profile });
});

// GET /api/ai/recommendations/redistribution
router.get('/recommendations/redistribution', (req, res) => {
  const districtId = req.query.district_id || 'dist_01';
  try {
    const plan = generateDistrictRedistributionPlan(db, districtId);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chatbot
router.post('/chatbot', (req, res) => {
  const { query, user = {} } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query text is required' });
  }

  const response = handleChatbotQuery(db, user, query);
  res.json(response);
});

module.exports = router;
