/**
 * MediSync PHC - Nearby Stock Finder & Redistribution Optimizer
 * Uses Haversine Formula to compute geodesic distances between PHCs
 */

// Haversine formula to calculate distance in km between two lat/lng coordinates
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

/**
 * Find nearby PHCs holding surplus for one or multiple medicines
 */
function findNearbySurplus(db, requestingPhcId, medicineIds, maxRadiusKm = 40) {
  const reqPhc = db.prepare('SELECT * FROM phcs WHERE id = ?').get(requestingPhcId);
  if (!reqPhc) {
    throw new Error('Requesting PHC not found');
  }

  const medIdList = Array.isArray(medicineIds) ? medicineIds : [medicineIds];
  if (medIdList.length === 0) return [];

  // Get all other PHCs in the district
  const otherPhcs = db.prepare('SELECT * FROM phcs WHERE id != ? AND district_id = ?').all(requestingPhcId, reqPhc.district_id);

  // Compute distance to each PHC
  const phcDistances = {};
  for (const p of otherPhcs) {
    const dist = calculateHaversineDistance(reqPhc.latitude, reqPhc.longitude, p.latitude, p.longitude);
    if (dist <= maxRadiusKm) {
      phcDistances[p.id] = {
        phc: p,
        distance_km: dist
      };
    }
  }

  const resultsByPhc = {};

  for (const medId of medIdList) {
    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medId);
    if (!medicine) continue;

    // For each candidate PHC within radius, calculate current stock & spareable surplus
    for (const donorPhcId of Object.keys(phcDistances)) {
      const donor = phcDistances[donorPhcId];

      // Current stock in donor PHC
      const batchRows = db.prepare(`
        SELECT id, batch_number, expiry_date, quantity, supplier_source
        FROM batches
        WHERE phc_id = ? AND medicine_id = ? AND quantity > 0
        ORDER BY expiry_date ASC
      `).all(donorPhcId, medId);

      const totalStock = batchRows.reduce((sum, b) => sum + b.quantity, 0);
      if (totalStock <= 0) continue;

      // 30-day consumption at donor PHC
      const entries = db.prepare(`
        SELECT issued_qty FROM stock_entries
        WHERE phc_id = ? AND medicine_id = ?
        ORDER BY entry_date DESC LIMIT 30
      `).all(donorPhcId, medId);

      const totalIssued = entries.reduce((sum, e) => sum + e.issued_qty, 0);
      const avgDaily = entries.length > 0 ? (totalIssued / entries.length) : 2;
      const daysOfStock = avgDaily > 0 ? Math.round(totalStock / avgDaily) : 999;

      // Spareable surplus: donor must maintain at least 35 days (or 45 for critical) buffer
      const reserveDays = medicine.critical ? 45 : 35;
      const reservedBuffer = Math.ceil(avgDaily * reserveDays);
      const spareable = Math.max(0, totalStock - reservedBuffer);

      if (spareable > 0 || (daysOfStock >= 40 && totalStock >= 20)) {
        if (!resultsByPhc[donorPhcId]) {
          resultsByPhc[donorPhcId] = {
            donor_phc_id: donorPhcId,
            donor_phc_name: donor.phc.name,
            block_id: donor.phc.block_id,
            distance_km: donor.distance_km,
            phone: donor.phc.phone,
            medical_officer_name: donor.phc.medical_officer_name,
            pharmacist_name: donor.phc.pharmacist_name,
            latitude: donor.phc.latitude,
            longitude: donor.phc.longitude,
            matches: []
          };
        }

        // Near-expiry prioritization: if earliest batch expires within 120 days, prioritize it
        const earliestBatch = batchRows[0];
        const daysToExpiry = earliestBatch ? Math.round((new Date(earliestBatch.expiry_date) - new Date()) / (1000 * 3600 * 24)) : 999;

        resultsByPhc[donorPhcId].matches.push({
          medicine_id: medicine.id,
          medicine_code: medicine.code,
          medicine_name: medicine.name,
          form: medicine.form,
          strength: medicine.strength,
          category: medicine.category,
          unit: medicine.unit,
          cold_chain: Boolean(medicine.cold_chain),
          critical: Boolean(medicine.critical),
          total_stock: totalStock,
          spareable_surplus: spareable > 0 ? spareable : Math.floor(totalStock * 0.3),
          donor_days_of_stock: daysOfStock,
          earliest_batch: earliestBatch ? earliestBatch.batch_number : null,
          earliest_expiry: earliestBatch ? earliestBatch.expiry_date : null,
          days_to_expiry: daysToExpiry,
          urgency_score: daysToExpiry < 90 ? 'EXPIRING_SOON_PRIORITY' : 'STABLE'
        });
      }
    }
  }

  // Convert to array and sort by distance
  const sortedDonorList = Object.values(resultsByPhc).sort((a, b) => a.distance_km - b.distance_km);

  return {
    requesting_phc: {
      id: reqPhc.id,
      name: reqPhc.name,
      latitude: reqPhc.latitude,
      longitude: reqPhc.longitude
    },
    donors: sortedDonorList
  };
}

/**
 * Block & District Level Automated Redistribution Optimizer
 * Matches shortages with optimal nearby surplus across the district
 */
function generateDistrictRedistributionPlan(db, districtId = 'dist_01') {
  const phcs = db.prepare('SELECT * FROM phcs WHERE district_id = ?').all(districtId);
  const medicines = db.prepare('SELECT * FROM medicines').all();

  const shortages = [];
  const surpluses = [];

  for (const phc of phcs) {
    for (const med of medicines) {
      // Calculate current stock
      const batchSum = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as current_stock,
               MIN(expiry_date) as nearest_expiry,
               MIN(id) as batch_id,
               MIN(batch_number) as batch_number
        FROM batches
        WHERE phc_id = ? AND medicine_id = ? AND quantity > 0
      `).get(phc.id, med.id);

      const currentStock = batchSum ? batchSum.current_stock : 0;

      // 30 days consumption
      const entries = db.prepare(`
        SELECT issued_qty FROM stock_entries
        WHERE phc_id = ? AND medicine_id = ?
        ORDER BY entry_date DESC LIMIT 30
      `).all(phc.id, med.id);

      const totalIssued = entries.reduce((sum, e) => sum + e.issued_qty, 0);
      const avgDaily = entries.length > 0 ? (totalIssued / entries.length) : 2;
      const daysLeft = avgDaily > 0 ? Math.round(currentStock / avgDaily) : 999;

      const threshold = med.critical ? 20 : med.min_threshold_days;

      if (daysLeft < threshold) {
        // Need stock
        const deficitQty = Math.max(20, Math.ceil((35 - daysLeft) * avgDaily));
        shortages.push({
          phc,
          medicine: med,
          currentStock,
          daysLeft,
          avgDaily,
          deficitQty,
          urgency: daysLeft < 7 ? 'HIGH' : 'MEDIUM'
        });
      } else if (daysLeft > 50 && currentStock > 40) {
        // Surplus
        const spareable = Math.max(0, Math.floor(currentStock - (avgDaily * 40)));
        if (spareable > 15) {
          surpluses.push({
            phc,
            medicine: med,
            currentStock,
            daysLeft,
            avgDaily,
            spareable,
            batch_id: batchSum.batch_id,
            batch_number: batchSum.batch_number,
            nearest_expiry: batchSum.nearest_expiry
          });
        }
      }
    }
  }

  // Pair shortages with closest surplus
  const proposedTransfers = [];
  const unfulfilledShortages = [];

  for (const shortage of shortages) {
    const matchingSurpluses = surpluses.filter(s => s.medicine.id === shortage.medicine.id && s.spareable > 0 && s.phc.id !== shortage.phc.id);

    if (matchingSurpluses.length === 0) {
      unfulfilledShortages.push(shortage);
      continue;
    }

    // Sort by distance
    matchingSurpluses.forEach(s => {
      s.distance_km = calculateHaversineDistance(shortage.phc.latitude, shortage.phc.longitude, s.phc.latitude, s.phc.longitude);
    });
    matchingSurpluses.sort((a, b) => a.distance_km - b.distance_km);

    const bestDonor = matchingSurpluses[0];
    if (bestDonor.distance_km > 35) {
      // Too far for standard PHC-to-PHC transfer -> route to district emergency indent
      unfulfilledShortages.push(shortage);
      continue;
    }

    const transferQty = Math.min(shortage.deficitQty, bestDonor.spareable);
    bestDonor.spareable -= transferQty;

    proposedTransfers.push({
      from_phc_id: bestDonor.phc.id,
      from_phc_name: bestDonor.phc.name,
      from_phc_phone: bestDonor.phc.phone,
      to_phc_id: shortage.phc.id,
      to_phc_name: shortage.phc.name,
      to_phc_phone: shortage.phc.phone,
      medicine_id: shortage.medicine.id,
      medicine_name: shortage.medicine.name,
      form: shortage.medicine.form,
      unit: shortage.medicine.unit,
      cold_chain: Boolean(shortage.medicine.cold_chain),
      critical: Boolean(shortage.medicine.critical),
      quantity: transferQty,
      distance_km: bestDonor.distance_km,
      batch_number: bestDonor.batch_number,
      batch_id: bestDonor.batch_id,
      expiry_date: bestDonor.nearest_expiry,
      reason: `Automated rebalancing: ${shortage.phc.name} has only ${shortage.daysLeft} days remaining (${shortage.currentStock} ${shortage.medicine.unit}), while ${bestDonor.phc.name} has ${bestDonor.daysLeft} days surplus.`
    });
  }

  // Group transfers by donor-receiver pair to optimize transport runs
  const groupedTransfers = {};
  for (const t of proposedTransfers) {
    const pairKey = `${t.from_phc_id}_to_${t.to_phc_id}`;
    if (!groupedTransfers[pairKey]) {
      groupedTransfers[pairKey] = {
        route_key: pairKey,
        from_phc: { id: t.from_phc_id, name: t.from_phc_name, phone: t.from_phc_phone },
        to_phc: { id: t.to_phc_id, name: t.to_phc_name, phone: t.to_phc_phone },
        distance_km: t.distance_km,
        has_cold_chain: false,
        total_items_count: 0,
        items: []
      };
    }
    if (t.cold_chain) groupedTransfers[pairKey].has_cold_chain = true;
    groupedTransfers[pairKey].total_items_count += 1;
    groupedTransfers[pairKey].items.push(t);
  }

  return {
    district_id: districtId,
    total_shortages_detected: shortages.length,
    fulfillable_via_nearby_transfers: proposedTransfers.length,
    grouped_delivery_runs: Object.values(groupedTransfers),
    unfulfilled_needing_district_indent: unfulfilledShortages.map(s => ({
      phc_id: s.phc.id,
      phc_name: s.phc.name,
      medicine_id: s.medicine.id,
      medicine_name: s.medicine.name,
      current_stock: s.currentStock,
      days_left: s.daysLeft,
      recommended_indent_qty: s.deficitQty * 2, // 2-month district order
      critical: Boolean(s.medicine.critical)
    }))
  };
}

module.exports = {
  calculateHaversineDistance,
  findNearbySurplus,
  generateDistrictRedistributionPlan
};
