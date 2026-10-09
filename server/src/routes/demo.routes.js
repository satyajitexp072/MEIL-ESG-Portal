const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demo.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Public view of demo entries and summary (requires authentication)
router.get('/entries', protect, demoController.getEntries);
router.get('/entries/:id', protect, demoController.getEntryById);
router.get('/summary', protect, demoController.getDemoSummary);

// Step 1: Site ESG Data Collector submission & resubmission (site_engineer or corporate_admin)
router.post(
  '/submit',
  protect,
  restrictTo('site_engineer', 'corporate_admin'),
  upload.array('evidenceFiles', 5),
  demoController.submitEntry
);
router.put(
  '/entries/:id/resubmit',
  protect,
  restrictTo('site_engineer', 'corporate_admin'),
  upload.array('evidenceFiles', 5),
  demoController.resubmitEntry
);

// Step 2: BU Sustainability Reviewer (bu_manager or corporate_admin)
router.post(
  '/entries/:id/bu-review',
  protect,
  restrictTo('bu_manager', 'corporate_admin'),
  demoController.buReviewEntry
);

// Step 3: Lead ESG Assurance Auditor (sustainability_auditor or corporate_admin)
router.post(
  '/entries/:id/auditor-review',
  protect,
  restrictTo('sustainability_auditor', 'corporate_admin'),
  demoController.auditorReviewEntry
);

// Step 4: CSO / Corporate Admin final sign-off & safe reset (corporate_admin only)
router.post(
  '/entries/:id/corporate-signoff',
  protect,
  restrictTo('corporate_admin'),
  demoController.corporateSignoffEntry
);

router.post(
  '/reset',
  protect,
  restrictTo('corporate_admin'),
  demoController.resetDemoWorkspace
);

module.exports = router;
