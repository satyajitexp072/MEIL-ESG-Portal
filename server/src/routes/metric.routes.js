const express = require('express');
const router = express.Router();
const metricController = require('../controllers/metric.controller');
const { protect } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Protected preview calculation for live mathematical breakdown in UI
router.post('/preview', protect, metricController.previewCalculation);

// Protected metric operations requiring valid JWT
router.get('/', protect, metricController.getAllMetrics);
router.get('/:id', protect, metricController.getMetricById);
router.post('/', protect, upload.array('evidenceFiles', 5), metricController.createMetricEntry);
router.post('/:id/evidence', protect, upload.array('evidenceFiles', 5), metricController.uploadEvidence);

module.exports = router;
