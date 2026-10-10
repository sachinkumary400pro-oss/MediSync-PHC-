const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { calculateHaversineDistance } = require('../services/recommender');
const { sendNotification } = require('../services/notification');

// GET /api/transfers?phc_id=&status=
router.get('/', (req, res) => {
  const { phc_id, status } = req.query;
  let query = `
    SELECT tr.*, 
           from_p.name as from_phc_name, from_p.phone as from_phc_phone,
           to_p.name as to_phc_name, to_p.phone as to_phc_phone,
           (SELECT COUNT(*) FROM transfer_items WHERE transfer_id = tr.id) as item_count
    FROM transfer_requests tr
    JOIN phcs from_p ON tr.from_phc_id = from_p.id
    JOIN phcs to_p ON tr.to_phc_id = to_p.id
    WHERE 1=1
  `;
  const params = [];
  if (phc_id) {
    query += ' AND (tr.from_phc_id = ? OR tr.to_phc_id = ?)';
    params.push(phc_id, phc_id);
  }
  if (status) {
    query += ' AND tr.status = ?';
    params.push(status);
  }
  query += ' ORDER BY tr.created_at DESC';

  const transfers = db.prepare(query).all(...params);

  // Fetch items for each transfer
  for (const t of transfers) {
    t.items = db.prepare(`
      SELECT ti.*, m.name as medicine_name, m.unit, m.form, m.strength, m.cold_chain, m.critical
      FROM transfer_items ti
      JOIN medicines m ON ti.medicine_id = m.id
      WHERE ti.transfer_id = ?
    `).all(t.id);
  }

  res.json({ transfers });
});

// GET /api/transfers/:id (Slip / Detail)
router.get('/:id', (req, res) => {
  const transfer = db.prepare(`
    SELECT tr.*, 
           from_p.name as from_phc_name, from_p.phone as from_phc_phone, from_p.address as from_phc_address, from_p.medical_officer_name as from_mo,
           to_p.name as to_phc_name, to_p.phone as to_phc_phone, to_p.address as to_phc_address, to_p.medical_officer_name as to_mo
    FROM transfer_requests tr
    JOIN phcs from_p ON tr.from_phc_id = from_p.id
    JOIN phcs to_p ON tr.to_phc_id = to_p.id
    WHERE tr.id = ?
  `).get(req.params.id);

  if (!transfer) return res.status(404).json({ error: 'Transfer request not found' });

  transfer.items = db.prepare(`
    SELECT ti.*, m.name as medicine_name, m.code as medicine_code, m.unit, m.form, m.strength, m.cold_chain, m.critical
    FROM transfer_items ti
    JOIN medicines m ON ti.medicine_id = m.id
    WHERE ti.transfer_id = ?
  `).all(transfer.id);

  res.json({ transfer });
});

// POST /api/transfers
router.post('/', authenticateToken, (req, res) => {
  const { from_phc_id, to_phc_id, urgency = 'normal', notes, cold_chain_verified, items } = req.body;

  if (!from_phc_id || !to_phc_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Source PHC, destination PHC, and at least 1 item are required' });
  }

  // Check cold-chain requirement
  const hasColdChainItem = items.some(item => {
    const med = db.prepare('SELECT cold_chain FROM medicines WHERE id = ?').get(item.medicine_id);
    return med && med.cold_chain === 1;
  });

  if (hasColdChainItem && !cold_chain_verified) {
    return res.status(400).json({
      error: 'Cold-chain handling must be confirmed for temperature-sensitive items (vaccines, insulin, ASV).'
    });
  }

  // Calculate distance
  const p1 = db.prepare('SELECT latitude, longitude FROM phcs WHERE id = ?').get(from_phc_id);
  const p2 = db.prepare('SELECT latitude, longitude FROM phcs WHERE id = ?').get(to_phc_id);
  const distanceKm = (p1 && p2) ? calculateHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude) : 0;

  const id = `tr_${Date.now()}`;
  const count = db.prepare('SELECT COUNT(*) as count FROM transfer_requests').get().count + 1;
  const requestNumber = `TR-2026-CPT-${String(count).padStart(4, '0')}`;

  const insertReq = db.prepare(`
    INSERT INTO transfer_requests (id, request_number, from_phc_id, to_phc_id, status, urgency, notes, cold_chain_verified, distance_km, created_by)
    VALUES (?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?)
  `);

  insertReq.run(id, requestNumber, from_phc_id, to_phc_id, urgency, notes || '', cold_chain_verified ? 1 : 0, distanceKm, req.user.full_name);

  const insertItem = db.prepare(`
    INSERT INTO transfer_items (id, transfer_id, medicine_id, batch_id, requested_qty, approved_qty)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let idx = 0; idx < items.length; idx++) {
    const itm = items[idx];
    insertItem.run(`tri_${id}_${idx}`, id, itm.medicine_id, itm.batch_id || null, itm.requested_qty, itm.requested_qty);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, 'CREATE_TRANSFER', 'transfer_requests', ?, ?)
  `).run(`aud_${Date.now()}`, req.user.id, id, `Created transfer ${requestNumber} from ${from_phc_id} to ${to_phc_id}`);

  // Mock notification to donor PHC Medical Officer
  const donorPhc = db.prepare('SELECT phone, name FROM phcs WHERE id = ?').get(from_phc_id);
  const reqPhc = db.prepare('SELECT name FROM phcs WHERE id = ?').get(to_phc_id);
  if (donorPhc) {
    sendNotification(db, {
      recipientPhone: donorPhc.phone,
      recipientRole: 'Medical Officer',
      channel: 'WHATSAPP',
      message: `New Inter-PHC Stock Request ${requestNumber}: ${reqPhc ? reqPhc.name : 'Nearby PHC'} requested stock transfer (${distanceKm} km away). Please review and approve.`
    });
  }

  res.status(201).json({
    id,
    request_number: requestNumber,
    message: 'Transfer request submitted successfully'
  });
});

// PATCH /api/transfers/:id/status
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { status, notes } = req.body;
  const validStatuses = ['requested', 'approved', 'in_transit', 'received', 'completed', 'rejected'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const transfer = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(req.params.id);
  if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

  // Update status
  let approvedBy = transfer.approved_by;
  let receivedBy = transfer.received_by;
  if (status === 'approved') approvedBy = req.user.full_name;
  if (status === 'completed' || status === 'received') receivedBy = req.user.full_name;

  db.prepare(`
    UPDATE transfer_requests
    SET status = ?, approved_by = ?, received_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, approvedBy, receivedBy, transfer.id);

  // If status is completed, automatically adjust stock at both PHCs!
  if (status === 'completed') {
    const items = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(transfer.id);

    for (const item of items) {
      const qty = item.approved_qty || item.requested_qty;

      // 1. Deduct from donor PHC batches
      const donorBatch = db.prepare(`
        SELECT id, quantity, expiry_date, batch_number FROM batches
        WHERE phc_id = ? AND medicine_id = ? AND quantity >= ?
        ORDER BY expiry_date ASC LIMIT 1
      `).get(transfer.from_phc_id, item.medicine_id, qty);

      if (donorBatch) {
        db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(qty, donorBatch.id);

        // Record donor stock entry
        db.prepare(`
          INSERT INTO stock_entries (id, phc_id, medicine_id, batch_id, entry_date, opening_stock, received_qty, issued_qty, closing_stock, remarks, created_by)
          VALUES (?, ?, ?, ?, date('now'), ?, 0, ?, ?, ?, ?)
        `).run(
          `se_tr_out_${Date.now()}_${item.id}`,
          transfer.from_phc_id,
          item.medicine_id,
          donorBatch.id,
          donorBatch.quantity,
          qty,
          donorBatch.quantity - qty,
          `Inter-PHC Transfer Sent (${transfer.request_number})`,
          req.user.full_name
        );

        // 2. Add to receiving PHC batches
        let recipientBatch = db.prepare(`
          SELECT id, quantity FROM batches
          WHERE phc_id = ? AND medicine_id = ? AND batch_number = ?
        `).get(transfer.to_phc_id, item.medicine_id, donorBatch.batch_number);

        if (recipientBatch) {
          db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(qty, recipientBatch.id);
        } else {
          db.prepare(`
            INSERT INTO batches (id, phc_id, medicine_id, batch_number, expiry_date, quantity, supplier_source)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            `b_tr_in_${Date.now()}_${item.id}`,
            transfer.to_phc_id,
            item.medicine_id,
            donorBatch.batch_number,
            donorBatch.expiry_date,
            qty,
            `Transfer from ${transfer.from_phc_id}`
          );
        }

        // Record receiver stock entry
        db.prepare(`
          INSERT INTO stock_entries (id, phc_id, medicine_id, batch_id, entry_date, opening_stock, received_qty, issued_qty, closing_stock, remarks, created_by)
          VALUES (?, ?, ?, ?, date('now'), 0, ?, 0, ?, ?, ?)
        `).run(
          `se_tr_in_${Date.now()}_${item.id}`,
          transfer.to_phc_id,
          item.medicine_id,
          donorBatch.id,
          qty,
          qty,
          `Inter-PHC Transfer Received (${transfer.request_number})`,
          req.user.full_name
        );
      }
    }

    // Resolve any low-stock alerts at receiving PHC
    db.prepare(`
      UPDATE alerts
      SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
      WHERE phc_id = ? AND status != 'resolved'
    `).run(req.user.full_name, transfer.to_phc_id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, 'UPDATE_TRANSFER_STATUS', 'transfer_requests', ?, ?)
  `).run(`aud_${Date.now()}`, req.user.id, transfer.id, `Transfer ${transfer.request_number} updated to ${status}`);

  res.json({ success: true, status, message: `Transfer status changed to ${status}` });
});

module.exports = router;
