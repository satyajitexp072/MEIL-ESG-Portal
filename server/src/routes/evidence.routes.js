const express = require('express');
const router = express.Router();
const evidenceController = require('../controllers/evidence.controller');
const { protect } = require('../middlewares/auth.middleware');

// Authenticated and entity-authorized download route
router.get('/:filename', protect, evidenceController.downloadEvidence);

module.exports = router;
