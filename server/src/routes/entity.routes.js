const express = require('express');
const router = express.Router();
const entityController = require('../controllers/entity.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

router.get('/', protect, entityController.getAllEntities);
router.get('/:id', protect, entityController.getEntityById);
router.post('/', protect, restrictTo('corporate_admin'), entityController.createEntity);

module.exports = router;
