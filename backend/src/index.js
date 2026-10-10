const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Ensure DB is initialized
require('./database');

const authRoutes = require('./routes/auth');
const medicinesRoutes = require('./routes/medicines');
const phcsRoutes = require('./routes/phcs');
const stockRoutes = require('./routes/stock');
const nearbyRoutes = require('./routes/nearby');
const transfersRoutes = require('./routes/transfers');
const indentsRoutes = require('./routes/indents');
const alertsRoutes = require('./routes/alerts');
const aiRoutes = require('./routes/ai');
const reportsRoutes = require('./routes/reports');
const publicRoutes = require('./routes/public');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/phcs', phcsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/nearby-stock', nearbyRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/indents', indentsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MediSync PHC Backend API',
    district: 'Chengalpattu, Tamil Nadu',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static assets from frontend/dist
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));

// For SPA client-side routing, serve index.html for any unhandled non-API routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🏥 MediSync PHC API Server running on port ${PORT}`);
  console.log(`🌍 District: Chengalpattu, Tamil Nadu (15 PHCs active)`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
