const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config();

const { validateJwtConfig } = require('./config/jwt');

// Validate JWT and security configuration on startup
validateJwtConfig();

const connectDB = require('./config/db');

// Route files
const authRoutes = require('./routes/auth.routes');
const entityRoutes = require('./routes/entity.routes');
const factorRoutes = require('./routes/factor.routes');
const metricRoutes = require('./routes/metric.routes');
const verificationRoutes = require('./routes/verification.routes');
const reportRoutes = require('./routes/report.routes');
const evidenceRoutes = require('./routes/evidence.routes');
const disclosureRoutes = require('./routes/disclosure.routes');
const demoRoutes = require('./routes/demo.routes');
const { seedEvidenceFiles } = require('./services/pdfGenerator');

const app = express();

// Connect to MongoDB
connectDB();

// Ensure authentic evidence PDFs are available on disk
seedEvidenceFiles(path.resolve(__dirname, '../uploads'));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Protected evidence file download routes (No unauthenticated static serving!)
app.use('/uploads', evidenceRoutes);
app.use('/api/evidence', evidenceRoutes);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/factors', factorRoutes);
app.use('/api/metrics', metricRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/disclosures', disclosureRoutes);
app.use('/api/demo', demoRoutes);

// Base Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'MEIL-ESG-Portal API',
    version: '1.0.0',
    disclaimer: 'System assists internal ESG aggregation and does not substitute third-party statutory assurance.',
    timestamp: new Date()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[MEIL-ESG-Portal Server] Running on http://localhost:${PORT}`);
});
