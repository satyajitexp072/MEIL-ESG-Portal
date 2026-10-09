const MetricEntry = require('../models/MetricEntry');
const EmissionFactor = require('../models/EmissionFactor');
const AuditLog = require('../models/AuditLog');
const Entity = require('../models/Entity');
const { calculateEmissions } = require('../services/calculations');

// Preview calculation without saving to DB (Zero-Trust: Client-supplied evidence/verification flags ignored)
exports.previewCalculation = async (req, res) => {
  try {
    const { activityValue, activityUnit, emissionFactorId, entityId } = req.body;
    if (activityValue === undefined || !activityUnit || !emissionFactorId) {
      return res.status(400).json({ success: false, message: 'activityValue, activityUnit, and emissionFactorId are required.' });
    }

    // Entity-level access control for preview
    if (req.user && req.user.role === 'site_engineer') {
      const userAssignedEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : null;
      if (entityId && userAssignedEntityStr && entityId !== userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: Site Engineers can only preview calculations for their assigned entity (${userAssignedEntityStr}).`
        });
      }
    }

    const factor = await EmissionFactor.findById(emissionFactorId);
    if (!factor) {
      return res.status(404).json({ success: false, message: 'Emission factor not found.' });
    }

    // Zero-trust preview: preview cannot claim verified zero status without persisted evidence and auditor sign-off
    const calculation = calculateEmissions(
      Number(activityValue),
      activityUnit,
      factor,
      { isPreview: true, hasQualifyingEvidence: false, isVerifiedScope2Claim: false }
    );

    res.json({
      success: true,
      factor,
      calculation
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Create a new metric entry (Maker role)
exports.createMetricEntry = async (req, res) => {
  try {
    const {
      entityId,
      scope,
      category,
      subCategory,
      financialYear,
      quarter,
      month,
      activityValue,
      activityUnit,
      emissionFactorId,
      notes,
      isDemoData
    } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Role-based access: Reviewers / Auditors should not be creating operational data entries
    if (req.user.role === 'sustainability_auditor') {
      return res.status(403).json({
        success: false,
        message: 'Auditors are restricted to independent assurance and verification. Operational data must be created by Site Engineers or BU Managers.'
      });
    }

    // Determine and enforce entity boundary (Zero-trust client entityId)
    let effectiveEntityId = entityId;
    if (req.user.role === 'site_engineer') {
      const userAssignedEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : null;
      if (!userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Your account is not assigned to any site or project entity.'
        });
      }

      if (entityId && entityId !== userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: Site Engineers can only submit data for their assigned entity (${userAssignedEntityStr}).`
        });
      }
      effectiveEntityId = userAssignedEntityStr;
    }

    const entityExists = await Entity.findById(effectiveEntityId);
    if (!entityExists) {
      return res.status(404).json({ success: false, message: 'Target entity not found.' });
    }

    const factor = await EmissionFactor.findById(emissionFactorId);
    if (!factor) {
      return res.status(404).json({ success: false, message: 'Emission factor not found.' });
    }

    // Check for qualifying Scope 2 contractual/telemetry evidence
    const qualifyingDocTypes = ['PPA_CONTRACT', 'GREEN_TARIFF_REC', 'CAPTIVE_SOLAR_LOG', 'CAPTIVE_SOLAR_SCADA_LOG'];
    const declaredDocType = (req.body.documentType || '').toUpperCase();
    const hasQualifyingEvidence = Boolean(
      req.files && req.files.length > 0 && (
        qualifyingDocTypes.includes(declaredDocType) ||
        req.files.some(f => {
          const name = f.originalname.toLowerCase();
          return name.includes('ppa') || name.includes('rec') || name.includes('scada') || name.includes('solar');
        })
      )
    );

    // Newly submitted entries are unverified by default. Server ignores client-supplied status or flags.
    const calculation = calculateEmissions(
      Number(activityValue),
      activityUnit,
      factor,
      { hasQualifyingEvidence, isVerifiedScope2Claim: false }
    );

    // Identity is strictly sourced from server-side authenticated session
    const userName = req.user.name;
    const userRole = req.user.role;
    const userId = req.user._id;

    const newEntry = new MetricEntry({
      entity: effectiveEntityId,
      scope: Number(scope),
      category: factor.category || category,
      subCategory: subCategory || factor.subCategory,
      reportingPeriod: {
        financialYear: financialYear || req.body.reportingPeriod?.financialYear || 'FY 2024-25',
        quarter: quarter || req.body.reportingPeriod?.quarter || 'Q1',
        month: month || req.body.reportingPeriod?.month || 'April'
      },
      activityData: {
        value: Number(activityValue),
        unit: activityUnit
      },
      emissionFactor: emissionFactorId,
      calculatedEmissions: {
        co2Tonnes: calculation.co2Tonnes,
        co2eTonnes: calculation.co2eTonnes,
        co2eStatus: calculation.co2eStatus,
        gasCoverage: calculation.gasCoverage,
        energyMWh: calculation.energyMWh,
        isRenewable: calculation.isRenewable,
        scope2DualReporting: calculation.scope2DualReporting,
        formulaApplied: calculation.formulaApplied,
        calculationSteps: calculation.calculationSteps
      },
      // Status is strictly enforced to 'Submitted'; untrusted frontend status is ignored
      status: 'Submitted',
      reviewHistory: [{
        action: 'SUBMITTED',
        performedBy: userId,
        performedByName: userName,
        role: req.user.roleTitle || userRole,
        remarks: 'Initial operational data entry submitted for expert review and verification.',
        timestamp: new Date()
      }],
      notes: notes || '',
      invoiceNumber: (req.body.invoiceNumber || req.body.sourceRecordId || '').trim(),
      sourceRecordId: (req.body.sourceRecordId || req.body.invoiceNumber || '').trim(),
      isDemoData: Boolean(isDemoData)
    });

    // Check if evidence files were uploaded in this request
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        let docType = declaredDocType || 'OTHER';
        const nameLower = file.originalname.toLowerCase();
        if (nameLower.includes('ppa')) docType = 'PPA_CONTRACT';
        else if (nameLower.includes('rec')) docType = 'GREEN_TARIFF_REC';
        else if (nameLower.includes('scada') || nameLower.includes('solar')) docType = 'CAPTIVE_SOLAR_SCADA_LOG';

        newEntry.evidenceDocuments.push({
          originalName: file.originalname,
          fileName: file.filename,
          filePath: `/uploads/${file.filename}`,
          fileType: file.mimetype,
          fileSize: file.size,
          documentType: docType,
          invoiceNumber: req.body.invoiceNumber || '',
          vendorName: req.body.vendorName || '',
          uploadedBy: userId,
          uploadedAt: new Date()
        });
      });
    }

    const savedEntry = await newEntry.save();

    // Log to immutable Audit Log
    await AuditLog.create({
      entity: effectiveEntityId,
      metricEntry: savedEntry._id,
      action: 'METRIC_SUBMITTED',
      performedBy: userId,
      performedByName: userName,
      role: userRole,
      details: {
        scope: savedEntry.scope,
        co2Tonnes: calculation.co2Tonnes,
        gasCoverage: calculation.gasCoverage,
        activity: `${activityValue} ${activityUnit} of ${subCategory}`,
        factorCitation: factor.sourceCitation
      }
    });

    res.status(201).json({ success: true, metric: savedEntry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all metrics with filters
exports.getAllMetrics = async (req, res) => {
  try {
    const { entity, scope, status, financialYear, isDemoData } = req.query;
    const filter = {};

    // Site Engineers are strictly restricted to reading records for their assigned entity
    if (req.user && req.user.role === 'site_engineer') {
      const userAssignedEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : null;
      if (!userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Your account is not assigned to any site or project entity.'
        });
      }
      if (entity && entity !== userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: Site Engineers are restricted to their assigned entity (${userAssignedEntityStr}) and cannot query records of other entities.`
        });
      }
      filter.entity = userAssignedEntityStr;
    } else if (entity) {
      filter.entity = entity;
    }

    if (scope) filter.scope = Number(scope);
    if (status) filter.status = status;
    if (financialYear) filter['reportingPeriod.financialYear'] = financialYear;
    if (isDemoData !== undefined) filter.isDemoData = isDemoData === 'true';

    const metrics = await MetricEntry.find(filter)
      .populate('entity')
      .populate('emissionFactor')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: metrics.length, metrics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single metric with full audit trace
exports.getMetricById = async (req, res) => {
  try {
    const metric = await MetricEntry.findById(req.params.id)
      .populate('entity')
      .populate('emissionFactor');

    if (!metric) {
      return res.status(404).json({ success: false, message: 'Metric entry not found.' });
    }

    // Role check: Site Engineers can ONLY view metric records of their assigned entity
    if (req.user && req.user.role === 'site_engineer') {
      const userAssignedEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : '';
      const metricEntityStr = metric.entity ? (metric.entity._id ? metric.entity._id.toString() : metric.entity.toString()) : '';
      if (!userAssignedEntityStr || metricEntityStr !== userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to view metric records belonging to other entities.'
        });
      }
    }

    const auditLogs = await AuditLog.find({ metricEntry: metric._id }).sort({ timestamp: 1 });

    res.json({ success: true, metric, auditLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload supporting evidence document to an existing entry
exports.uploadEvidence = async (req, res) => {
  try {
    const metric = await MetricEntry.findById(req.params.id).populate('emissionFactor');
    if (!metric) {
      return res.status(404).json({ success: false, message: 'Metric entry not found.' });
    }

    // Role check: If site_engineer, verify it is their entity
    if (req.user.role === 'site_engineer') {
      const userEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : '';
      if (metric.entity.toString() !== userEntityStr) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot attach evidence to records of other entities.'
        });
      }
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No evidence files uploaded.' });
    }

    const uploadedDocs = req.files.map(file => ({
      originalName: file.originalname,
      fileName: file.filename,
      filePath: `/uploads/${file.filename}`,
      fileType: file.mimetype,
      fileSize: file.size,
      invoiceNumber: req.body.invoiceNumber || '',
      vendorName: req.body.vendorName || '',
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    }));

    metric.evidenceDocuments.push(...uploadedDocs);

    // Recompute calculation if Scope 2 zero claim to update evidence status
    if (metric.scope === 2 && metric.emissionFactor) {
      const hasEvidence = metric.evidenceDocuments.length > 0;
      const isVerified = (metric.status === 'Verified');
      const recalc = calculateEmissions(
        metric.activityData.value,
        metric.activityData.unit,
        metric.emissionFactor,
        { hasEvidence, isVerified }
      );
      metric.calculatedEmissions.co2Tonnes = recalc.co2Tonnes;
      metric.calculatedEmissions.co2eTonnes = recalc.co2eTonnes;
      metric.calculatedEmissions.scope2DualReporting = recalc.scope2DualReporting;
      metric.calculatedEmissions.isRenewable = recalc.isRenewable;
      metric.calculatedEmissions.formulaApplied = recalc.formulaApplied;
      metric.calculatedEmissions.calculationSteps = recalc.calculationSteps;
    }

    await metric.save();

    await AuditLog.create({
      entity: metric.entity,
      metricEntry: metric._id,
      action: 'EVIDENCE_ATTACHED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      role: req.user.role,
      details: { files: uploadedDocs.map(d => d.originalName) }
    });

    res.json({ success: true, evidenceDocuments: metric.evidenceDocuments, calculatedEmissions: metric.calculatedEmissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
