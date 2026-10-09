const express = require('express');
const router = express.Router();
const disclosureController = require('../controllers/disclosure.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Public published disclosures are protected with authentication
router.get('/', protect, disclosureController.getDisclosures);
router.get('/:id', protect, disclosureController.getDisclosureById);

// Trigger import of Olectra Greentech public disclosures (restricted to authorized roles)
router.post(
  '/import-olectra',
  protect,
  restrictTo('corporate_admin', 'lead_auditor', 'esg_reviewer'),
  disclosureController.importOlectra
);

module.exports = router;
