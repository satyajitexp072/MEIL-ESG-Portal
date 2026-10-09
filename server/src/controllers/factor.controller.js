const EmissionFactor = require('../models/EmissionFactor');

exports.getAllFactors = async (req, res) => {
  try {
    const { scope, fuelOrGridType, includeLegacy } = req.query;
    const filter = {};
    if (scope) filter.scope = Number(scope);
    if (fuelOrGridType) filter.fuelOrGridType = new RegExp(fuelOrGridType, 'i');
    if (!includeLegacy || includeLegacy === 'false') {
      filter.factorCode = { $exists: true, $ne: null };
    }

    const factors = await EmissionFactor.find(filter).sort({ scope: 1, category: 1, name: 1 });
    res.json({ success: true, count: factors.length, factors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFactorById = async (req, res) => {
  try {
    const factor = await EmissionFactor.findById(req.params.id);
    if (!factor) {
      return res.status(404).json({ success: false, message: 'Emission factor not found.' });
    }
    res.json({ success: true, factor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
