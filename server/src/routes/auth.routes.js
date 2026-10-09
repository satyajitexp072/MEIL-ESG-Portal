const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

router.post('/login', authController.login);
router.get('/me', protect, authController.getMe);
router.get('/users', protect, restrictTo('corporate_admin'), authController.listUsers);

module.exports = router;
