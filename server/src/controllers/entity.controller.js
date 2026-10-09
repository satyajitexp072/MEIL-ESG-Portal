const Entity = require('../models/Entity');

exports.getAllEntities = async (req, res) => {
  try {
    let filter = {};
    if (req.user && req.user.role === 'site_engineer') {
      const userAssignedEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : null;
      filter = userAssignedEntityStr ? { _id: userAssignedEntityStr } : { _id: null };
    }

    const entities = await Entity.find(filter).populate('parentEntity').sort({ type: 1, name: 1 });
    res.json({ success: true, count: entities.length, entities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEntityById = async (req, res) => {
  try {
    if (req.user && req.user.role === 'site_engineer') {
      const userAssignedEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : null;
      if (!userAssignedEntityStr || req.params.id !== userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to view details of other entities.'
        });
      }
    }

    const entity = await Entity.findById(req.params.id).populate('parentEntity');
    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found.' });
    }
    const children = await Entity.find({ parentEntity: entity._id });
    res.json({ success: true, entity, children });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEntity = async (req, res) => {
  try {
    const entity = await Entity.create(req.body);
    res.status(201).json({ success: true, entity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
