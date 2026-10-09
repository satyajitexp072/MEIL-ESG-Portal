const MetricEntry = require('../models/MetricEntry');
const AuditLog = require('../models/AuditLog');
const { calculateEmissions } = require('../services/calculations');

// Expert Human Reviewer / Auditor verification action
exports.reviewMetric = async (req, res) => {
  try {
    const { action, remarks, verifiedScope2Claim, claimCheckDetails } = req.body;
    const metricId = req.params.id;

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Role-based authorization: Only authorized reviewer roles can verify or reject records
    const authorizedReviewRoles = ['bu_manager', 'sustainability_auditor', 'corporate_admin'];
    if (!authorizedReviewRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role forbidden: Your role (${req.user.role}) is not authorized to verify or reject sustainability metrics.`
      });
    }

    if (!['VERIFIED', 'REJECTED', 'UNDER_REVIEW'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid review action. Must be VERIFIED, REJECTED, or UNDER_REVIEW.' });
    }

    if (!remarks || remarks.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Review remarks are mandatory to maintain a traceable audit trail.' });
    }

    const metric = await MetricEntry.findById(metricId).populate('entity').populate('emissionFactor');
    if (!metric) {
      return res.status(404).json({ success: false, message: 'Metric entry not found.' });
    }

    // Segregation of Duties (Maker-Checker): A user cannot verify or approve their own submission
    const originalSubmission = metric.reviewHistory.find(r => r.action === 'SUBMITTED');
    if (originalSubmission && originalSubmission.performedBy && originalSubmission.performedBy.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Maker-Checker Segregation Violation: You cannot review, verify, or reject your own data submission.'
      });
    }

    const previousStatus = metric.status;
    let newStatus = 'Under_Review';
    if (action === 'VERIFIED') newStatus = 'Verified';
    if (action === 'REJECTED') newStatus = 'Rejected';

    metric.status = newStatus;

    // Check for qualifying evidence relevant to the actual contractual/captive claim
    const qualifyingDocTypes = ['PPA_CONTRACT', 'GREEN_TARIFF_REC', 'CAPTIVE_SOLAR_LOG', 'CAPTIVE_SOLAR_SCADA_LOG'];
    const hasQualifyingEvidence = Boolean(
      metric.evidenceDocuments &&
      metric.evidenceDocuments.length > 0 &&
      metric.evidenceDocuments.some(doc => {
        const type = (doc.documentType || '').toUpperCase();
        if (qualifyingDocTypes.includes(type)) return true;
        const name = (doc.originalName || '').toLowerCase();
        return name.includes('ppa') || name.includes('rec') || name.includes('scada') || name.includes('solar');
      })
    );

    // Human auditor must explicitly audit the instrument; a generic Verified status alone is insufficient
    const isPeriodValid = (req.body.isPeriodValid !== undefined) ? Boolean(req.body.isPeriodValid) : true;
    const isRejected = (newStatus === 'Rejected');
    const coveredQuantityMWh = (req.body.coveredQuantityMWh !== undefined && req.body.coveredQuantityMWh !== null) ? Number(req.body.coveredQuantityMWh) : undefined;
    const isVerifiedScope2Claim = (newStatus === 'Verified') && Boolean(verifiedScope2Claim) && hasQualifyingEvidence && isPeriodValid;

    // Recalculate if Scope 2 to update market-based zero-claim verification state
    if (metric.scope === 2 && metric.emissionFactor) {
      const recalc = calculateEmissions(
        metric.activityData.value,
        metric.activityData.unit,
        metric.emissionFactor,
        { hasQualifyingEvidence, isVerifiedScope2Claim, isRejected, isPeriodValid, coveredQuantityMWh }
      );
      metric.calculatedEmissions.co2Tonnes = recalc.co2Tonnes;
      metric.calculatedEmissions.co2eTonnes = recalc.co2eTonnes;
      metric.calculatedEmissions.co2eStatus = recalc.co2eStatus;
      metric.calculatedEmissions.scope2DualReporting = recalc.scope2DualReporting;
      metric.calculatedEmissions.isRenewable = recalc.isRenewable;
      metric.calculatedEmissions.formulaApplied = recalc.formulaApplied;
      metric.calculatedEmissions.calculationSteps = recalc.calculationSteps;
    }

    // Update status and append to review history (Identity strictly from req.user)
    metric.reviewHistory.push({
      action,
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.roleTitle || req.user.role,
      remarks: remarks.trim(),
      verifiedScope2Claim: isVerifiedScope2Claim,
      claimCheckDetails: claimCheckDetails ? claimCheckDetails.trim() : (isVerifiedScope2Claim ? 'Audited qualifying contractual instrument & generation log' : 'General operational metric verification only'),
      timestamp: new Date()
    });

    await metric.save();

    // Immutable audit entry
    await AuditLog.create({
      entity: metric.entity._id,
      metricEntry: metric._id,
      action: `METRIC_${action}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      details: {
        previousStatus,
        newStatus,
        remarks: remarks.trim(),
        co2Tonnes: metric.calculatedEmissions.co2Tonnes,
        evidenceAttachedCount: metric.evidenceDocuments.length,
        scope2DualReporting: metric.calculatedEmissions.scope2DualReporting
      }
    });

    res.json({
      success: true,
      message: `Metric entry successfully updated to status "${newStatus}" by human expert reviewer.`,
      metric
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Queue of pending reviews
exports.getPendingVerifications = async (req, res) => {
  try {
    const queue = await MetricEntry.find({ status: { $in: ['Submitted', 'Under_Review'] } })
      .populate('entity')
      .populate('emissionFactor')
      .sort({ createdAt: 1 });

    const stats = {
      totalPending: queue.length,
      scope1Count: queue.filter(m => m.scope === 1).length,
      scope2Count: queue.filter(m => m.scope === 2).length,
      withEvidenceCount: queue.filter(m => m.evidenceDocuments && m.evidenceDocuments.length > 0).length
    };

    res.json({ success: true, stats, queue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
