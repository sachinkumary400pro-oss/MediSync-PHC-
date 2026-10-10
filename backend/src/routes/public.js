const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculateConsumptionMetrics } = require('../services/forecasting');

// GET /api/public/phcs
router.get('/phcs', (req, res) => {
  const phcs = db.prepare(`
    SELECT p.id, p.name, p.phone, p.address, b.name as block_name
    FROM phcs p
    JOIN blocks b ON p.block_id = b.id
    ORDER BY p.name ASC
  `).all();
  res.json({ phcs });
});

// GET /api/public/medicines
router.get('/medicines', (req, res) => {
  const medicines = db.prepare(`
    SELECT id, code, name, generic_name, form, strength, category
    FROM medicines
    ORDER BY name ASC
  `).all();
  res.json({ medicines });
});

// GET /api/public/availability?phc_id=&medicine_id=
// Strictly complies with requirement: "checks whether a medicine is available at a PHC, see 'Available / Low / Out of stock' only (no exact quantities, no patient data)"
router.get('/availability', (req, res) => {
  const { phc_id, medicine_id } = req.query;

  if (!phc_id) {
    return res.status(400).json({ error: 'phc_id query parameter is required' });
  }

  let targetPhcId = phc_id;
  let phc = db.prepare('SELECT id, name, phone, address FROM phcs WHERE id = ?').get(targetPhcId);
  if (!phc) {
    phc = db.prepare('SELECT id, name, phone, address FROM phcs WHERE id = ? OR name LIKE ?').get(targetPhcId.replace('phc_', 'phc_cpt_'), `%${targetPhcId}%`);
    if (phc) targetPhcId = phc.id;
  }

  if (!phc) {
    return res.status(404).json({ error: `PHC '${phc_id}' not found` });
  }

  if (medicine_id) {
    let targetMedId = medicine_id;
    let medicine = db.prepare('SELECT id, name, form, strength FROM medicines WHERE id = ?').get(targetMedId);
    if (!medicine) {
      medicine = db.prepare('SELECT id, name, form, strength FROM medicines WHERE code = ? OR name LIKE ?').get(targetMedId, `%${targetMedId}%`);
      if (medicine) targetMedId = medicine.id;
    }

    if (!medicine) {
      return res.status(404).json({ error: `Medicine '${medicine_id}' not found` });
    }

    const metrics = calculateConsumptionMetrics(db, targetPhcId, targetMedId);

    let publicStatus = 'AVAILABLE';
    let badgeColor = 'green';
    let publicText = 'In Stock (இருப்பில் உள்ளது)';

    if (metrics.current_stock === 0) {
      publicStatus = 'OUT_OF_STOCK';
      badgeColor = 'red';
      publicText = 'Currently Unavailable (தற்போது இருப்பில் இல்லை)';
    } else if (metrics.days_left < 10) {
      publicStatus = 'LOW_STOCK';
      badgeColor = 'amber';
      publicText = 'Limited Supply (குறைந்த அளவு இருப்பு)';
    }

    return res.json({
      phc: {
        name: phc.name,
        address: phc.address,
        phone: phc.phone
      },
      medicine: {
        name: medicine.name,
        form: medicine.form,
        strength: medicine.strength
      },
      status: publicStatus,
      badge_color: badgeColor,
      status_display: publicText,
      as_of: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
  }

  // If no medicine_id provided, return all medicines for this PHC
  const medicines = db.prepare('SELECT id, name, form, strength, category FROM medicines').all();
  const results = medicines.map(m => {
    const met = calculateConsumptionMetrics(db, targetPhcId, m.id);
    let s = 'AVAILABLE';
    let b = 'green';
    let txt = 'In Stock';
    if (!met || met.current_stock === 0) {
      s = 'OUT_OF_STOCK';
      b = 'red';
      txt = 'Unavailable';
    } else if (met.days_left < 10) {
      s = 'LOW_STOCK';
      b = 'amber';
      txt = 'Limited';
    }
    return {
      medicine_id: m.id,
      medicine_name: m.name,
      category: m.category,
      form: m.form,
      stock_status: s,
      badge_color: b,
      status_display: txt
    };
  });

  res.json({
    phc: { name: phc.name, address: phc.address, phone: phc.phone },
    total_medicines: results.length,
    medicines: results
  });
});

module.exports = router;
