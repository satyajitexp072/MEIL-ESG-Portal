const JuryDemoMetric = require('../models/JuryDemoMetric');
const Entity = require('../models/Entity');
const EmissionFactor = require('../models/EmissionFactor');
const AuditLog = require('../models/AuditLog');
const { calculateEmissions } = require('../services/calculations');

/**
 * 1. List all entries in the Jury Demo workspace
 */
exports.getEntries = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.entityId) {
      filter.entity = req.query.entityId;
    }

    const entries = await JuryDemoMetric.find(filter)
      .populate('entity')
      .populate('emissionFactor')
      .populate('reviewHistory.performedBy', 'name email role roleTitle')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      count: entries.length,
      entries
    });
  } catch (err) {
    console.error('Error fetching demo entries:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Get a single demo entry by ID
 */
exports.getEntryById = async (req, res) => {
  try {
    const entry = await JuryDemoMetric.findById(req.params.id)
      .populate('entity')
      .populate('emissionFactor')
      .populate('reviewHistory.performedBy', 'name email role roleTitle');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Jury Demo entry not found.' });
    }

    res.json({ success: true, entry });
  } catch (err) {
    console.error('Error fetching demo entry by id:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 3. Step 1: Site ESG Data Collector submits entry with evidence
 * Allowed: site_engineer (or corporate_admin)
 */
exports.submitEntry = async (req, res) => {
  try {
    if (!['site_engineer', 'corporate_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role forbidden: Only Site ESG Data Collectors (or Corporate Admin) can submit operational activity data. Current role is "${req.user.role}".`
      });
    }

    const {
      entityId,
      scope,
      category,
      subCategory,
      financialYear = 'FY 2024-25',
      quarter = 'Q1',
      month = 'April',
      activityValue,
      activityUnit,
      emissionFactorId,
      invoiceNumber = '',
      notes = ''
    } = req.body;

    if (!entityId || !scope || !category || !subCategory || !activityValue || !activityUnit || !emissionFactorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: entity, scope, category, subCategory, activityValue, activityUnit, and emissionFactorId are mandatory.'
      });
    }

    const numValue = Number(activityValue);
    if (isNaN(numValue) || numValue <= 0) {
      return res.status(400).json({ success: false, message: 'Activity value must be a positive number.' });
    }

    const [entity, factor] = await Promise.all([
      Entity.findById(entityId),
      EmissionFactor.findById(emissionFactorId)
    ]);

    if (!entity) return res.status(404).json({ success: false, message: 'Entity not found.' });
    if (!factor) return res.status(404).json({ success: false, message: 'Emission Factor not found.' });

    // Process uploaded evidence files
    const evidenceDocuments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        evidenceDocuments.push({
          originalName: file.originalname,
          fileName: file.filename,
          filePath: `/uploads/${file.filename}`,
          fileType: file.mimetype,
          fileSize: file.size,
          documentType: req.body.documentType || 'OTHER',
          invoiceNumber: invoiceNumber.trim(),
          vendorName: req.body.vendorName || '',
          uploadedBy: req.user._id,
          uploadedAt: new Date()
        });
      });
    }

    const hasQualifyingEvidence = evidenceDocuments.length > 0;

    // Execute emissions calculation using real mathematical engine
    const calculated = calculateEmissions(numValue, activityUnit.trim(), factor, {
      hasQualifyingEvidence,
      isVerifiedScope2Claim: false,
      isPeriodValid: true
    });

    const newEntry = new JuryDemoMetric({
      entity: entity._id,
      scope: Number(scope),
      category: category.trim(),
      subCategory: subCategory.trim(),
      reportingPeriod: {
        financialYear,
        quarter,
        month
      },
      activityData: {
        value: numValue,
        unit: activityUnit.trim()
      },
      emissionFactor: factor._id,
      calculatedEmissions: calculated,
      evidenceDocuments,
      status: 'SUBMITTED',
      invoiceNumber: invoiceNumber.trim(),
      notes: notes.trim(),
      isJuryDemo: true,
      reviewHistory: [
        {
          action: 'SUBMITTED',
          performedBy: req.user._id,
          performedByName: req.user.name,
          role: req.user.role,
          roleTitle: req.user.roleTitle || 'Site ESG Data Collector',
          previousStatus: 'NEW',
          newStatus: 'SUBMITTED',
          remarks: 'Initial operational activity submission with attached verification evidence.',
          timestamp: new Date()
        }
      ]
    });

    await newEntry.save();

    await AuditLog.create({
      entity: entity._id,
      action: 'DEMO_METRIC_SUBMITTED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      details: {
        demoMetricId: newEntry._id,
        scope: newEntry.scope,
        co2Tonnes: calculated.co2Tonnes,
        evidenceCount: evidenceDocuments.length
      }
    });

    res.status(201).json({
      success: true,
      message: 'Jury Demo entry successfully submitted. Ready for BU Sustainability Review.',
      entry: newEntry
    });
  } catch (err) {
    console.error('Error submitting demo entry:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Step 1b: Resubmit entry after correction
 * Allowed: site_engineer (or corporate_admin)
 */
exports.resubmitEntry = async (req, res) => {
  try {
    if (!['site_engineer', 'corporate_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role forbidden: Only Site ESG Data Collectors (or Corporate Admin) can resubmit operational activity data. Current role is "${req.user.role}".`
      });
    }

    const entry = await JuryDemoMetric.findById(req.params.id)
      .populate('entity')
      .populate('emissionFactor');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Demo entry not found.' });
    }

    if (entry.status !== 'RETURNED_FOR_CORRECTION') {
      return res.status(400).json({
        success: false,
        message: `Only entries with status "RETURNED_FOR_CORRECTION" can be resubmitted. Current status is "${entry.status}".`
      });
    }

    const { activityValue, activityUnit, invoiceNumber, notes, resubmissionRemarks } = req.body;

    if (activityValue !== undefined && activityValue !== null) {
      const num = Number(activityValue);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({ success: false, message: 'Activity value must be a positive number.' });
      }
      entry.activityData.value = num;
    }

    if (activityUnit) {
      entry.activityData.unit = activityUnit.trim();
    }
    if (invoiceNumber !== undefined) {
      entry.invoiceNumber = invoiceNumber.trim();
    }
    if (notes !== undefined) {
      entry.notes = notes.trim();
    }

    // Process newly uploaded evidence files if provided
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        entry.evidenceDocuments.push({
          originalName: file.originalname,
          fileName: file.filename,
          filePath: `/uploads/${file.filename}`,
          fileType: file.mimetype,
          fileSize: file.size,
          documentType: req.body.documentType || 'OTHER',
          invoiceNumber: entry.invoiceNumber,
          vendorName: req.body.vendorName || '',
          uploadedBy: req.user._id,
          uploadedAt: new Date()
        });
      });
    }

    const hasQualifyingEvidence = entry.evidenceDocuments.length > 0;

    // Recalculate emissions with updated values
    const recalculated = calculateEmissions(
      entry.activityData.value,
      entry.activityData.unit,
      entry.emissionFactor,
      { hasQualifyingEvidence, isVerifiedScope2Claim: false, isPeriodValid: true }
    );
    entry.calculatedEmissions = recalculated;

    const previousStatus = entry.status;
    entry.status = 'RESUBMITTED';

    entry.reviewHistory.push({
      action: 'RESUBMITTED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      roleTitle: req.user.roleTitle || 'Site ESG Data Collector',
      previousStatus,
      newStatus: 'RESUBMITTED',
      remarks: (resubmissionRemarks && resubmissionRemarks.trim()) || 'Corrected activity data and revised evidence resubmitted for review.',
      timestamp: new Date()
    });

    await entry.save();

    res.json({
      success: true,
      message: 'Demo entry successfully corrected and resubmitted for BU Review.',
      entry
    });
  } catch (err) {
    console.error('Error resubmitting demo entry:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 5. Step 2: BU Sustainability Reviewer review action
 * Allowed: bu_manager, corporate_admin
 */
exports.buReviewEntry = async (req, res) => {
  try {
    const { action, remarks } = req.body;
    const entry = await JuryDemoMetric.findById(req.params.id)
      .populate('entity')
      .populate('emissionFactor');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Demo entry not found.' });
    }

    if (!['SUBMITTED', 'RESUBMITTED'].includes(entry.status)) {
      return res.status(400).json({
        success: false,
        message: `BU Review can only be performed on SUBMITTED or RESUBMITTED entries. Current status is "${entry.status}".`
      });
    }

    if (!['BU_APPROVE', 'RETURN_FOR_CORRECTION', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid BU review action. Must be BU_APPROVE, RETURN_FOR_CORRECTION, or REJECT.'
      });
    }

    if (!remarks || remarks.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review remarks are mandatory to maintain a complete traceable audit trail.'
      });
    }

    // Segregation of Duties: Maker cannot Checker (Original submitter or resubmitter cannot review)
    const isOriginalSubmitterOrResubmitter = entry.reviewHistory.some(
      r => ['SUBMITTED', 'RESUBMITTED'].includes(r.action) &&
           r.performedBy &&
           r.performedBy.toString() === req.user._id.toString()
    );
    if (isOriginalSubmitterOrResubmitter) {
      return res.status(403).json({
        success: false,
        message: 'Maker-Checker Segregation Violation: You cannot review your own submission.'
      });
    }

    const previousStatus = entry.status;
    let newStatus = 'BU_APPROVED';
    if (action === 'RETURN_FOR_CORRECTION') newStatus = 'RETURNED_FOR_CORRECTION';
    if (action === 'REJECT') newStatus = 'REJECTED';

    entry.status = newStatus;

    entry.reviewHistory.push({
      action: action === 'BU_APPROVE' ? 'BU_APPROVED' : action,
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      roleTitle: req.user.roleTitle || 'BU Sustainability Reviewer',
      previousStatus,
      newStatus,
      remarks: remarks.trim(),
      timestamp: new Date()
    });

    await entry.save();

    await AuditLog.create({
      entity: entry.entity._id,
      action: `DEMO_BU_REVIEW_${action}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      details: {
        demoMetricId: entry._id,
        previousStatus,
        newStatus,
        remarks: remarks.trim()
      }
    });

    res.json({
      success: true,
      message: `BU Review complete. Status updated to "${newStatus}".`,
      entry
    });
  } catch (err) {
    console.error('Error in BU review:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 6. Step 3: Independent Sustainability Auditor assurance verification
 * Allowed: sustainability_auditor, corporate_admin
 */
exports.auditorReviewEntry = async (req, res) => {
  try {
    const { action, remarks, verifiedScope2Claim = false, isPeriodValid = true, coveredQuantityMWh } = req.body;
    const entry = await JuryDemoMetric.findById(req.params.id)
      .populate('entity')
      .populate('emissionFactor');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Demo entry not found.' });
    }

    if (entry.status !== 'BU_APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Independent Auditor verification requires prior BU approval. Current status is "${entry.status}".`
      });
    }

    if (!['AUDIT_VERIFY', 'RETURN_FOR_CORRECTION', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Auditor action. Must be AUDIT_VERIFY, RETURN_FOR_CORRECTION, or REJECT.'
      });
    }

    if (!remarks || remarks.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Assurance remarks and audit findings are mandatory.'
      });
    }

    // Segregation of Duties: Independent auditor cannot be anyone who submitted, resubmitted, or performed BU review
    const isOriginalSubmitterOrResubmitter = entry.reviewHistory.some(
      r => ['SUBMITTED', 'RESUBMITTED'].includes(r.action) &&
           r.performedBy &&
           r.performedBy.toString() === req.user._id.toString()
    );
    if (isOriginalSubmitterOrResubmitter) {
      return res.status(403).json({
        success: false,
        message: 'Maker-Checker Segregation Violation: Independent auditor cannot be the original submitter.'
      });
    }

    const isBUReviewer = entry.reviewHistory.some(
      r => ['BU_APPROVED', 'RETURN_FOR_CORRECTION', 'REJECT'].includes(r.action) &&
           r.performedBy &&
           r.performedBy.toString() === req.user._id.toString()
    );
    if (isBUReviewer) {
      return res.status(403).json({
        success: false,
        message: 'Maker-Checker Segregation Violation: Independent third-party auditor cannot be the person who conducted the internal BU review.'
      });
    }

    const previousStatus = entry.status;
    let newStatus = 'AUDITOR_VERIFIED';
    if (action === 'RETURN_FOR_CORRECTION') newStatus = 'RETURNED_FOR_CORRECTION';
    if (action === 'REJECT') newStatus = 'REJECTED';

    entry.status = newStatus;

    // Check evidence qualification for Scope 2 market claims
    const qualifyingDocTypes = ['PPA_CONTRACT', 'GREEN_TARIFF_REC', 'CAPTIVE_SOLAR_LOG', 'CAPTIVE_SOLAR_SCADA_LOG'];
    const hasQualifyingEvidence = Boolean(
      entry.evidenceDocuments &&
      entry.evidenceDocuments.length > 0 &&
      entry.evidenceDocuments.some(doc => {
        const type = (doc.documentType || '').toUpperCase();
        if (qualifyingDocTypes.includes(type)) return true;
        const name = (doc.originalName || '').toLowerCase();
        return name.includes('ppa') || name.includes('rec') || name.includes('scada') || name.includes('solar');
      })
    );

    const isScope2Claim = (newStatus === 'AUDITOR_VERIFIED') && Boolean(verifiedScope2Claim) && hasQualifyingEvidence && isPeriodValid;

    // Recalculate if Scope 2 to update market-based dual reporting
    if (entry.scope === 2 && entry.emissionFactor) {
      const recalculated = calculateEmissions(
        entry.activityData.value,
        entry.activityData.unit,
        entry.emissionFactor,
        {
          hasQualifyingEvidence,
          isVerifiedScope2Claim: isScope2Claim,
          isRejected: newStatus === 'REJECTED',
          isPeriodValid,
          coveredQuantityMWh: (coveredQuantityMWh !== undefined && coveredQuantityMWh !== null) ? Number(coveredQuantityMWh) : undefined
        }
      );
      entry.calculatedEmissions = recalculated;
    }

    entry.reviewHistory.push({
      action: action === 'AUDIT_VERIFY' ? 'AUDITOR_VERIFIED' : action,
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      roleTitle: req.user.roleTitle || 'Lead ESG Assurance Auditor',
      previousStatus,
      newStatus,
      remarks: remarks.trim(),
      verifiedScope2Claim: isScope2Claim,
      claimCheckDetails: isScope2Claim ? 'Audited qualifying contractual instrument & generation log' : 'General assurance verification completed',
      timestamp: new Date()
    });

    await entry.save();

    res.json({
      success: true,
      message: `Independent Auditor assurance complete. Status updated to "${newStatus}".`,
      entry
    });
  } catch (err) {
    console.error('Error in Auditor review:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 7. Step 4: CSO / Corporate Admin final statutory sign-off
 * Allowed: corporate_admin
 */
exports.corporateSignoffEntry = async (req, res) => {
  try {
    const { action, remarks } = req.body;
    const entry = await JuryDemoMetric.findById(req.params.id)
      .populate('entity')
      .populate('emissionFactor');

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Demo entry not found.' });
    }

    if (entry.status !== 'AUDITOR_VERIFIED') {
      return res.status(400).json({
        success: false,
        message: `Corporate sign-off requires prior Independent Auditor verification. Current status is "${entry.status}".`
      });
    }

    if (!['CORPORATE_SIGNOFF', 'RETURN_FOR_CORRECTION'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Corporate action. Must be CORPORATE_SIGNOFF or RETURN_FOR_CORRECTION.'
      });
    }

    if (!remarks || remarks.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Corporate sign-off remarks are mandatory.'
      });
    }

    const previousStatus = entry.status;
    let newStatus = 'CORPORATE_APPROVED';
    if (action === 'RETURN_FOR_CORRECTION') newStatus = 'RETURNED_FOR_CORRECTION';

    entry.status = newStatus;

    entry.reviewHistory.push({
      action: action === 'CORPORATE_SIGNOFF' ? 'CORPORATE_APPROVED' : action,
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      roleTitle: req.user.roleTitle || 'Chief Sustainability Officer & Corporate Admin',
      previousStatus,
      newStatus,
      remarks: remarks.trim(),
      timestamp: new Date()
    });

    await entry.save();

    res.json({
      success: true,
      message: `Corporate disclosure sign-off complete. Entry is now officially APPROVED for Jury Demo Summary.`,
      entry
    });
  } catch (err) {
    console.error('Error in Corporate sign-off:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 8. Safe Reset: Deletes ONLY Jury Demo workspace records
 * Allowed: corporate_admin
 */
exports.resetDemoWorkspace = async (req, res) => {
  try {
    const deleteResult = await JuryDemoMetric.deleteMany({});

    await AuditLog.create({
      action: 'DEMO_WORKSPACE_RESET',
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      details: {
        deletedCount: deleteResult.deletedCount,
        timestamp: new Date()
      }
    });

    res.json({
      success: true,
      message: `Jury Demo workspace safely reset. ${deleteResult.deletedCount} demo records deleted. Operational data remains untouched.`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (err) {
    console.error('Error resetting demo workspace:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 9. Jury Demo Summary: Aggregates approved demo records into disclosure totals
 */
exports.getDemoSummary = async (req, res) => {
  try {
    const allEntries = await JuryDemoMetric.find({})
      .populate('entity')
      .populate('emissionFactor')
      .sort({ createdAt: 1 });

    const approvedEntries = allEntries.filter(e => e.status === 'CORPORATE_APPROVED');

    let totalScope1_tCO2 = 0;
    let totalScope2_Location_tCO2 = 0;
    let totalScope2_Market_tCO2 = 0;
    let totalScope2_Reportable_tCO2 = 0;
    let totalEnergy_MWh = 0;
    let renewableEnergy_MWh = 0;

    approvedEntries.forEach(entry => {
      const calc = entry.calculatedEmissions || {};
      if (entry.scope === 1) {
        totalScope1_tCO2 += calc.co2Tonnes || 0;
      } else if (entry.scope === 2) {
        totalScope2_Location_tCO2 += calc.scope2DualReporting?.locationBased_tCO2 || calc.co2Tonnes || 0;
        totalScope2_Market_tCO2 += calc.scope2DualReporting?.marketBased_tCO2 || 0;
        totalScope2_Reportable_tCO2 += calc.scope2DualReporting?.reportable_tCO2 || calc.co2Tonnes || 0;
      }

      totalEnergy_MWh += calc.energyMWh || 0;
      if (calc.isRenewable) {
        renewableEnergy_MWh += calc.energyMWh || 0;
      }
    });

    const renewablePercentage = totalEnergy_MWh > 0 ? Number(((renewableEnergy_MWh / totalEnergy_MWh) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      meta: {
        workspace: 'Jury Demonstration Workspace (Isolated)',
        totalSubmissions: allEntries.length,
        approvedForDisclosureCount: approvedEntries.length,
        pendingReviewCount: allEntries.filter(e => ['SUBMITTED', 'RESUBMITTED', 'BU_APPROVED', 'AUDITOR_VERIFIED'].includes(e.status)).length,
        returnedCount: allEntries.filter(e => e.status === 'RETURNED_FOR_CORRECTION').length,
        rejectedCount: allEntries.filter(e => e.status === 'REJECTED').length
      },
      summary: {
        scope1_Direct_tCO2: Number(totalScope1_tCO2.toFixed(2)),
        scope2_LocationBased_tCO2: Number(totalScope2_Location_tCO2.toFixed(2)),
        scope2_MarketBased_tCO2: Number(totalScope2_Market_tCO2.toFixed(2)),
        scope2_Reportable_tCO2: Number(totalScope2_Reportable_tCO2.toFixed(2)),
        totalScope1And2_tCO2: Number((totalScope1_tCO2 + totalScope2_Reportable_tCO2).toFixed(2)),
        totalEnergy_MWh: Number(totalEnergy_MWh.toFixed(2)),
        renewableEnergy_MWh: Number(renewableEnergy_MWh.toFixed(2)),
        renewablePercentage
      },
      approvedEntries,
      allEntries
    });
  } catch (err) {
    console.error('Error computing demo summary:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
