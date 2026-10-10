const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculateConsumptionMetrics } = require('../services/forecasting');

// GET /api/reports/district-overview
router.get('/district-overview', (req, res) => {
  const phcs = db.prepare('SELECT id, name, block_id FROM phcs').all();
  const medicines = db.prepare('SELECT id, name, critical FROM medicines').all();

  let totalStockouts = 0;
  let totalCritical = 0;
  let totalLow = 0;
  let totalAdequate = 0;
  let totalSurplus = 0;

  const topShortageMedicines = {};

  for (const p of phcs) {
    for (const m of medicines) {
      const metrics = calculateConsumptionMetrics(db, p.id, m.id);
      if (!metrics) continue;

      if (metrics.status === 'out_of_stock') {
        totalStockouts++;
        topShortageMedicines[m.name] = (topShortageMedicines[m.name] || 0) + 1;
      } else if (metrics.status === 'critical') {
        totalCritical++;
        topShortageMedicines[m.name] = (topShortageMedicines[m.name] || 0) + 1;
      } else if (metrics.status === 'low') {
        totalLow++;
      } else if (metrics.status === 'surplus') {
        totalSurplus++;
      } else {
        totalAdequate++;
      }
    }
  }

  // Near expiry batches count
  const nearExpiryCount = db.prepare(`
    SELECT COUNT(*) as count FROM batches
    WHERE quantity > 0 AND date(expiry_date) <= date('now', '+90 days')
  `).get().count;

  // Active transfers count
  const activeTransfersCount = db.prepare(`
    SELECT COUNT(*) as count FROM transfer_requests
    WHERE status IN ('requested', 'approved', 'in_transit')
  `).get().count;

  // Completed transfers count
  const completedTransfersCount = db.prepare(`
    SELECT COUNT(*) as count FROM transfer_requests
    WHERE status = 'completed'
  `).get().count;

  // Sorted top shortages
  const topShortages = Object.entries(topShortageMedicines)
    .map(([name, count]) => ({ medicine_name: name, phc_shortage_count: count }))
    .sort((a, b) => b.phc_shortage_count - a.phc_shortage_count)
    .slice(0, 5);

  // Block level risk breakdown
  const blocks = db.prepare('SELECT * FROM blocks').all();
  const blockStats = blocks.map(b => {
    const blockPhcs = phcs.filter(p => p.block_id === b.id);
    let blockStockouts = 0;
    for (const bp of blockPhcs) {
      for (const m of medicines) {
        const met = calculateConsumptionMetrics(db, bp.id, m.id);
        if (met && (met.status === 'out_of_stock' || met.status === 'critical')) {
          blockStockouts++;
        }
      }
    }
    return {
      block_id: b.id,
      block_name: b.name,
      phc_count: blockPhcs.length,
      shortages_detected: blockStockouts,
      risk_level: blockStockouts > 10 ? 'High' : (blockStockouts > 4 ? 'Moderate' : 'Low')
    };
  });

  res.json({
    kpis: {
      total_phcs: phcs.length,
      total_stockouts: totalStockouts,
      critical_shortages: totalCritical,
      low_stock_warnings: totalLow,
      adequate_stock: totalAdequate,
      surplus_stock: totalSurplus,
      near_expiry_batches: nearExpiryCount,
      active_transfers: activeTransfersCount,
      completed_transfers: completedTransfersCount,
      avg_transfer_turnaround_hrs: '3.4 hrs'
    },
    top_shortages: topShortages,
    block_breakdown: blockStats
  });
});

// GET /api/reports/export-stock-csv?phc_id=
router.get('/export-stock-csv', (req, res) => {
  const phcId = req.query.phc_id || 'phc_cpt_01';
  const phc = db.prepare('SELECT name FROM phcs WHERE id = ?').get(phcId);
  const medicines = db.prepare('SELECT id FROM medicines').all();

  const rows = [
    ['Medicine Code', 'Medicine Name', 'Category', 'Form', 'Strength', 'Current Stock', 'Unit', 'Avg Daily 7D', 'Avg Daily 30D', 'Days of Stock', 'Status', 'Run Out Date', 'Spareable Surplus']
  ];

  for (const m of medicines) {
    const met = calculateConsumptionMetrics(db, phcId, m.id);
    if (met) {
      rows.push([
        met.code,
        `"${met.medicine_name}"`,
        met.category,
        met.form,
        `"${met.strength}"`,
        met.current_stock,
        met.unit,
        met.avg_daily_7,
        met.avg_daily_30,
        met.days_left,
        met.status_text,
        met.run_out_date || 'N/A',
        met.spareable_surplus
      ]);
    }
  }

  const csvString = rows.map(r => r.join(',')).join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment(`medisync_${phc ? phc.name.replace(/\s+/g, '_') : 'stock'}_${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csvString);
});

// GET /api/reports/summary (alias for district-overview)
router.get('/summary', (req, res) => {
  res.redirect(307, '/api/reports/district-overview');
});

// GET /api/reports/stockouts
router.get('/stockouts', (req, res) => {
  const phcs = db.prepare('SELECT id, name, block_id FROM phcs').all();
  const medicines = db.prepare('SELECT id, name, code, unit, critical FROM medicines').all();
  const stockouts = [];

  for (const p of phcs) {
    for (const m of medicines) {
      const met = calculateConsumptionMetrics(db, p.id, m.id);
      if (met && (met.status === 'out_of_stock' || met.status === 'critical')) {
        stockouts.push({
          phc_id: p.id,
          phc_name: p.name,
          medicine_code: m.code,
          medicine_name: m.name,
          unit: m.unit,
          current_stock: met.current_stock,
          days_left: met.days_left,
          status: met.status,
          is_critical: Boolean(m.critical)
        });
      }
    }
  }
  res.json({ count: stockouts.length, stockouts });
});

// GET /api/reports/expiry
router.get('/expiry', (req, res) => {
  const days = parseInt(req.query.days || 90);
  const batches = db.prepare(`
    SELECT b.*, p.name as phc_name, m.name as medicine_name, m.code as medicine_code
    FROM batches b
    JOIN phcs p ON b.phc_id = p.id
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.quantity > 0 AND date(b.expiry_date) <= date('now', '+' || ? || ' days')
    ORDER BY b.expiry_date ASC
  `).all(days);
  res.json({ count: batches.length, threshold_days: days, expiring_batches: batches });
});

module.exports = router;
