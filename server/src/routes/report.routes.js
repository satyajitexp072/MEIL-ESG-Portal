const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/brsr-section-c', protect, reportController.getBRSRSectionC);
router.get('/brsr-pdf', protect, reportController.downloadBRSRPdf);
router.get('/scope3-roadmap', protect, reportController.getScope3Roadmap);

module.exports = router;
