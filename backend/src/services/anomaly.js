/**
 * MediSync PHC - Anomaly Detection Engine
 * Uses Z-Score statistical analysis to detect unusual stock drops and demand spikes
 */

function detectAnomalies(db, phcId = null) {
  let query = `
    SELECT se.phc_id, se.medicine_id, se.entry_date, se.issued_qty,
           p.name as phc_name, m.name as medicine_name, m.critical, m.unit
    FROM stock_entries se
    JOIN phcs p ON se.phc_id = p.id
    JOIN medicines m ON se.medicine_id = m.id
  `;
  const params = [];
  if (phcId) {
    query += ` WHERE se.phc_id = ? `;
    params.push(phcId);
  }
  query += ` ORDER BY se.phc_id, se.medicine_id, se.entry_date ASC`;

  const rows = db.prepare(query).all(...params);

  // Group by phc_id + medicine_id
  const grouped = {};
  for (const r of rows) {
    const key = `${r.phc_id}_${r.medicine_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        phc_id: r.phc_id,
        phc_name: r.phc_name,
        medicine_id: r.medicine_id,
        medicine_name: r.medicine_name,
        critical: r.critical,
        unit: r.unit,
        entries: []
      };
    }
    grouped[key].entries.push(r);
  }

  const anomalies = [];

  for (const key in grouped) {
    const item = grouped[key];
    const entries = item.entries;
    if (entries.length < 5) continue; // Need minimum baseline data

    // Exclude the most recent entry from baseline to test it
    const baseline = entries.slice(0, -1);
    const latest = entries[entries.length - 1];

    const issuedValues = baseline.map(e => e.issued_qty);
    const mean = issuedValues.reduce((a, b) => a + b, 0) / issuedValues.length;
    
    // Standard deviation
    const variance = issuedValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / issuedValues.length;
    const stdDev = Math.sqrt(variance);

    // Calculate Z-Score for latest day
    const zScore = stdDev > 0 ? (latest.issued_qty - mean) / stdDev : 0;

    // Detect abnormal spike: Z-score > 2.0 and value is at least 2.5x the mean
    if (zScore >= 2.0 && latest.issued_qty >= mean * 2.2 && latest.issued_qty >= 20) {
      anomalies.push({
        id: `anomaly_${item.phc_id}_${item.medicine_id}_${latest.entry_date}`,
        phc_id: item.phc_id,
        phc_name: item.phc_name,
        medicine_id: item.medicine_id,
        medicine_name: item.medicine_name,
        entry_date: latest.entry_date,
        observed_qty: latest.issued_qty,
        baseline_mean: parseFloat(mean.toFixed(1)),
        std_dev: parseFloat(stdDev.toFixed(1)),
        z_score: parseFloat(zScore.toFixed(2)),
        surge_ratio: parseFloat((latest.issued_qty / (mean || 1)).toFixed(1)),
        severity: zScore > 3.0 ? 'critical' : 'high',
        type: 'DEMAND_SPIKE',
        description: `Unusual consumption spike: ${latest.issued_qty} ${item.unit} issued vs baseline average of ${mean.toFixed(1)} ${item.unit} (Z=${zScore.toFixed(2)}). Possible fever/disease outbreak or event.`
      });
    }
  }

  return anomalies;
}

module.exports = {
  detectAnomalies
};
