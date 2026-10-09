const PublishedDisclosure = require('../models/PublishedDisclosure');
const { importOlectraDisclosures } = require('../services/olectraDisclosureImporter');

/**
 * List all published company-reported annual disclosures
 */
exports.getDisclosures = async (req, res) => {
  try {
    const { entityId, financialYear } = req.query;
    const filter = {};

    if (entityId) {
      filter.reportingEntity = entityId;
    }
    if (financialYear) {
      filter.financialYear = financialYear;
    }

    const disclosures = await PublishedDisclosure.find(filter)
      .populate('reportingEntity')
      .sort({ financialYear: -1 });

    res.json({
      success: true,
      count: disclosures.length,
      disclosures
    });
  } catch (err) {
    console.error('Error fetching published disclosures:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve published ESG disclosures',
      error: err.message
    });
  }
};

/**
 * Get a single published disclosure by ID
 */
exports.getDisclosureById = async (req, res) => {
  try {
    const disclosure = await PublishedDisclosure.findById(req.params.id)
      .populate('reportingEntity');

    if (!disclosure) {
      return res.status(404).json({
        success: false,
        message: 'Published disclosure record not found'
      });
    }

    res.json({
      success: true,
      disclosure
    });
  } catch (err) {
    console.error('Error fetching disclosure by id:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve published ESG disclosure',
      error: err.message
    });
  }
};

/**
 * Import or refresh Olectra Greentech Limited public annual report disclosures
 */
exports.importOlectra = async (req, res) => {
  try {
    const result = await importOlectraDisclosures();
    res.json(result);
  } catch (err) {
    console.error('Error importing Olectra disclosures:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to import Olectra public disclosures',
      error: err.message
    });
  }
};
