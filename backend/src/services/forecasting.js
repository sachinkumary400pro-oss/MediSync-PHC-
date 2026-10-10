/**
 * MediSync PHC - Consumption Forecasting & Days-of-Stock Engine
 */

function calculateConsumptionMetrics(db, phcId, medicineId) {
  // Fetch medicine details
  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId);
  if (!medicine) return null;

  // Calculate current stock from batches
  const batchSum = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as current_stock,
           MIN(expiry_date) as nearest_expiry,
           COUNT(*) as batch_count
    FROM batches 
    WHERE phc_id = ? AND medicine_id = ? AND quantity > 0
  `).get(phcId, medicineId);

  const currentStock = batchSum ? batchSum.current_stock : 0;
  const nearestExpiry = batchSum ? batchSum.nearest_expiry : null;

  // Fetch last 30 days stock entries
  const entries = db.prepare(`
    SELECT entry_date, issued_qty, closing_stock
    FROM stock_entries
    WHERE phc_id = ? AND medicine_id = ?
    ORDER BY entry_date DESC
    LIMIT 30
  `).all(phcId, medicineId);

  let totalIssued30 = 0;
  let totalIssued7 = 0;
  let count30 = entries.length;
  let count7 = Math.min(7, entries.length);

  for (let i = 0; i < entries.length; i++) {
    totalIssued30 += entries[i].issued_qty;
    if (i < 7) {
      totalIssued7 += entries[i].issued_qty;
    }
  }

  // Daily consumption rate (units/day)
  const avgDaily7 = count7 > 0 ? (totalIssued7 / count7) : 0;
  const avgDaily30 = count30 > 0 ? (totalIssued30 / count30) : 0;
  
  // Weighted consumption velocity (higher weight to recent 7 days: 70% 7-day, 30% 30-day)
  let effectiveDailyRate = 0;
  if (avgDaily7 > 0 && avgDaily30 > 0) {
    effectiveDailyRate = (avgDaily7 * 0.7) + (avgDaily30 * 0.3);
  } else if (avgDaily7 > 0) {
    effectiveDailyRate = avgDaily7;
  } else if (avgDaily30 > 0) {
    effectiveDailyRate = avgDaily30;
  } else {
    // Default baseline if no entries yet (e.g. 5 units/day based on population)
    effectiveDailyRate = 3;
  }

  // Days left
  const daysLeft = effectiveDailyRate > 0 ? Math.round(currentStock / effectiveDailyRate) : 999;

  // Thresholds
  const minThreshold = medicine.critical ? 20 : medicine.min_threshold_days; // Higher threshold for critical medicines
  const bufferThreshold = medicine.critical ? 40 : 30;

  // Status calculation
  let status = 'normal'; // 'green'
  let statusText = 'Adequate';
  if (currentStock === 0) {
    status = 'out_of_stock';
    statusText = 'Out of Stock';
  } else if (daysLeft < minThreshold) {
    status = 'critical'; // 'red'
    statusText = 'Critical Shortage';
  } else if (daysLeft <= bufferThreshold) {
    status = 'low'; // 'amber'
    statusText = 'Low Stock';
  } else if (daysLeft > 60) {
    status = 'surplus';
    statusText = 'Surplus Available';
  }

  // Trend detection (is demand accelerating or decelerating?)
  let trend = 'stable';
  if (avgDaily7 > avgDaily30 * 1.15) {
    trend = 'increasing';
  } else if (avgDaily7 < avgDaily30 * 0.85) {
    trend = 'decreasing';
  }

  // Projected run-out date
  let runOutDate = null;
  if (daysLeft < 365) {
    const d = new Date();
    d.setDate(d.getDate() + daysLeft);
    runOutDate = d.toISOString().split('T')[0];
  }

  // Spareable surplus: stock exceeding a 45-day safety buffer
  const safetyBufferDays = 45;
  const requiredSafetyBuffer = Math.round(effectiveDailyRate * safetyBufferDays);
  const spareableSurplus = Math.max(0, currentStock - requiredSafetyBuffer);

  return {
    medicine_id: medicine.id,
    medicine_name: medicine.name,
    code: medicine.code,
    category: medicine.category,
    form: medicine.form,
    strength: medicine.strength,
    unit: medicine.unit,
    cold_chain: Boolean(medicine.cold_chain),
    critical: Boolean(medicine.critical),
    current_stock: currentStock,
    nearest_expiry: nearestExpiry,
    avg_daily_7: parseFloat(avgDaily7.toFixed(1)),
    avg_daily_30: parseFloat(avgDaily30.toFixed(1)),
    effective_daily_rate: parseFloat(effectiveDailyRate.toFixed(1)),
    days_left: daysLeft,
    status,
    status_text: statusText,
    trend,
    run_out_date: runOutDate,
    spareable_surplus: spareableSurplus,
    min_threshold: minThreshold
  };
}

module.exports = {
  calculateConsumptionMetrics
};
