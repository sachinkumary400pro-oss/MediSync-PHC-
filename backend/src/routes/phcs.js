const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/phcs
router.get('/', (req, res) => {
  const { block_id, district_id } = req.query;
  let query = `
    SELECT p.*, b.name as block_name, d.name as district_name
    FROM phcs p
    JOIN blocks b ON p.block_id = b.id
    JOIN districts d ON p.district_id = d.id
    WHERE 1=1
  `;
  const params = [];
  if (block_id) {
    query += ' AND p.block_id = ?';
    params.push(block_id);
  }
  if (district_id) {
    query += ' AND p.district_id = ?';
    params.push(district_id);
  }
  query += ' ORDER BY b.name ASC, p.name ASC';

  const phcs = db.prepare(query).all(...params);
  const blocks = db.prepare('SELECT * FROM blocks ORDER BY name').all();
  const districts = db.prepare('SELECT * FROM districts').all();

  res.json({ phcs, blocks, districts });
});

// GET /api/phcs/:id
router.get('/:id', (req, res) => {
  const phc = db.prepare(`
    SELECT p.*, b.name as block_name, d.name as district_name
    FROM phcs p
    JOIN blocks b ON p.block_id = b.id
    JOIN districts d ON p.district_id = d.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!phc) return res.status(404).json({ error: 'PHC not found' });
  res.json({ phc });
});

module.exports = router;
