const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const identifier = req.body.username || req.body.email;
  const { password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const user = db.prepare(`
    SELECT u.*, p.name as phc_name, b.name as block_name, d.name as district_name
    FROM users u
    LEFT JOIN phcs p ON u.phc_id = p.id
    LEFT JOIN blocks b ON u.block_id = b.id
    LEFT JOIN districts d ON u.district_id = d.id
    WHERE u.username = ? OR u.email = ?
  `).get(identifier, identifier);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const payload = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    phc_id: user.phc_id,
    block_id: user.block_id,
    district_id: user.district_id
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
    VALUES (?, ?, 'USER_LOGIN', 'users', ?, ?)
  `).run(`aud_${Date.now()}`, user.id, user.id, `User ${user.username} logged in as ${user.role}`);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      phc_id: user.phc_id,
      phc_name: user.phc_name,
      block_id: user.block_id,
      block_name: user.block_name,
      district_id: user.district_id,
      district_name: user.district_name,
      phone: user.phone,
      email: user.email
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.phc_id, u.block_id, u.district_id, u.phone, u.email,
           p.name as phc_name, b.name as block_name, d.name as district_name
    FROM users u
    LEFT JOIN phcs p ON u.phc_id = p.id
    LEFT JOIN blocks b ON u.block_id = b.id
    LEFT JOIN districts d ON u.district_id = d.id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// GET /api/auth/users (for quick demo switching)
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.phc_id, u.block_id, u.phone,
           p.name as phc_name, b.name as block_name
    FROM users u
    LEFT JOIN phcs p ON u.phc_id = p.id
    LEFT JOIN blocks b ON u.block_id = b.id
    ORDER BY u.role
  `).all();
  res.json(users);
});

module.exports = router;
