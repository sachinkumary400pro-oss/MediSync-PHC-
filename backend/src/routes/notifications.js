const express = require('express');
const router = express.Router();
const db = require('../database');
const { getRecentNotifications } = require('../services/notification');

// GET /api/notifications
router.get('/', (req, res) => {
  const limit = req.query.limit || 30;
  const notifications = getRecentNotifications(db, parseInt(limit));
  res.json({ notifications });
});

module.exports = router;
