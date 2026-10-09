const express = require('express');
const router = express.Router();
const factorController = require('../controllers/factor.controller');

router.get('/', factorController.getAllFactors);
router.get('/:id', factorController.getFactorById);

module.exports = router;
