const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verification.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Only authorized reviewers/auditors and corporate admins can access pending review queues and submit verification decisions
router.get(
  '/pending',
  protect,
  restrictTo('bu_manager', 'sustainability_auditor', 'corporate_admin'),
  verificationController.getPendingVerifications
);

router.post(
  '/:id/review',
  protect,
  restrictTo('bu_manager', 'sustainability_auditor', 'corporate_admin'),
  verificationController.reviewMetric
);

module.exports = router;
