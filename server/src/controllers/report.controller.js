const MetricEntry = require('../models/MetricEntry');
const Entity = require('../models/Entity');
const { getScope3Status } = require('../services/calculations/scope3Stub');
const { generateBRSRReportPdf } = require('../services/pdfGenerator');

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const buildBRSRDisclosure = async (user, query = {}) => {
  if (!user) {
    throw createHttpError(401, 'Authentication required to access statutory BRSR disclosures.');
  }

  const { financialYear = 'FY 2024-25', entityId } = query;

  // Role-based reporting authorization:
  // Site Engineers can ONLY access reports for their explicitly assigned entity
  let effectiveEntityId = entityId;
  if (user.role === 'site_engineer') {
    const userAssignedEntityStr = user.assignedEntity ? (user.assignedEntity._id ? user.assignedEntity._id.toString() : user.assignedEntity.toString()) : null;
    if (!userAssignedEntityStr) {
      throw createHttpError(403, 'Access Denied: Your account is not assigned to any site or project entity.');
    }

    if (!entityId) {
      throw createHttpError(403, 'Access Denied: Site Engineers are restricted to their assigned entity and cannot generate group-wide reports.');
    }

    if (entityId !== userAssignedEntityStr) {
      throw createHttpError(403, `Access Denied: You are not authorized to view reports for other entities (${entityId}).`);
    }

    effectiveEntityId = userAssignedEntityStr;
  }

    const filter = {
      'reportingPeriod.financialYear': financialYear
    };
    if (effectiveEntityId) {
      filter.entity = effectiveEntityId;
    }

    const allMetrics = await MetricEntry.find(filter)
      .populate('entity')
      .populate('emissionFactor')
      .sort({ updatedAt: -1 }); // Deterministic: newest first

    // 1. Consolidated turnover calculation across reporting boundary (NO HARDCODED FALLBACKS & NO BLIND SUMS)
    let totalTurnoverINR_Crores = null;
    let turnoverStatus = 'AVAILABLE';
    let turnoverUnavailableReason = null;
    let reportingBoundary = 'Consolidated Organizational Level (MEIL Group)';

    if (effectiveEntityId) {
      const ent = await Entity.findById(effectiveEntityId);
      if (ent && ent.turnoverINR_Crores !== undefined && ent.turnoverINR_Crores !== null && ent.turnoverINR_Crores > 0) {
        totalTurnoverINR_Crores = ent.turnoverINR_Crores;
        reportingBoundary = `Specific Business Unit / Site: ${ent.name}`;
      } else {
        turnoverStatus = 'UNAVAILABLE';
        turnoverUnavailableReason = `Turnover figure is not established or reported for entity "${ent ? ent.name : effectiveEntityId}".`;
        reportingBoundary = `Specific Business Unit / Site: ${ent ? ent.name : effectiveEntityId}`;
      }
    } else {
      // Group consolidated boundary:
      // In accordance with corporate financial reporting and SEBI BRSR guidelines,
      // consolidated turnover is derived from the top-level Holding entity's audited consolidated financial statements.
      // We do NOT blindly sum parent and subsidiary turnover (which double-counts revenue before intercompany eliminations).
      const holdingEntity = await Entity.findOne({ type: 'Holding', status: 'Active' });
      if (holdingEntity && holdingEntity.turnoverINR_Crores !== undefined && holdingEntity.turnoverINR_Crores !== null && holdingEntity.turnoverINR_Crores > 0) {
        totalTurnoverINR_Crores = holdingEntity.turnoverINR_Crores;
        reportingBoundary = `Consolidated Organizational Level (MEIL Group - Consolidated Financial Statements of ${holdingEntity.name})`;
      } else {
        turnoverStatus = 'UNAVAILABLE';
        turnoverUnavailableReason = 'Consolidated organizational turnover has not been configured in the entity registry, or intercompany eliminations are unestablished.';
      }
    }

    // 2. Audit Summary & True-Duplicate Detection
    let verifiedCount = 0;
    let submittedCount = 0;
    let rejectedCount = 0;
    let evidenceAttachedCount = 0;

    const seenDocIds = new Set();
    const seenInvoiceKeys = new Set();
    const seenActivitySignatures = new Map();
    const flaggedDuplicateSlices = [];
    let duplicateSkippedCount = 0;

    // Only ELIGIBLE, VERIFIED, NON-DUPLICATE entries enter the official statutory totals
    const eligibleVerifiedMetrics = [];

    allMetrics.forEach(m => {
      if (m.status === 'Verified') {
        verifiedCount++;

        const docId = m._id ? m._id.toString() : '';
        const entityIdStr = m.entity ? (m.entity._id ? m.entity._id.toString() : m.entity.toString()) : 'UNKNOWN';
        const factorIdStr = m.emissionFactor ? (m.emissionFactor._id ? m.emissionFactor._id.toString() : m.emissionFactor.toString()) : 'UNKNOWN';
        const fy = m.reportingPeriod?.financialYear || '';
        const qtr = m.reportingPeriod?.quarter || '';
        const mo = m.reportingPeriod?.month || '';
        const val = m.activityData?.value ?? 0;
        const unit = m.activityData?.unit || '';

        // Extract genuine source-record identifier (e.g. invoiceNumber or sourceRecordId)
        const invoiceNum = (m.evidenceDocuments && m.evidenceDocuments[0]?.invoiceNumber) ||
          m.activityData?.invoiceNumber ||
          m.sourceRecordId ||
          m.invoiceNumber ||
          '';

        const hasExplicitSourceId = Boolean(invoiceNum && String(invoiceNum).trim() !== '' && String(invoiceNum).trim() !== 'N/A');

        // Check 1: Document ID duplicate (identical document returned twice)
        if (docId && seenDocIds.has(docId)) {
          duplicateSkippedCount++;
          return;
        }

        // Check 2: Genuine source-record identifier duplicate (identical invoice/voucher number for same entity and factor)
        if (hasExplicitSourceId) {
          const invKey = `${entityIdStr}_${factorIdStr}_${fy}_${String(invoiceNum).trim().toLowerCase()}`;
          if (seenInvoiceKeys.has(invKey)) {
            duplicateSkippedCount++;
            return;
          }
          seenInvoiceKeys.add(invKey);
        }

        if (docId) seenDocIds.add(docId);

        // Check 3: Multiple legitimate activity records can share entity, scope, factor, and period
        // If two records share identical signature (same entity, factor, period, and exact identical quantity)
        // without distinct invoice numbers, we include BOTH in totals but flag for auditor review:
        const sliceSig = `${entityIdStr}_${m.scope}_${factorIdStr}_${fy}_${qtr}_${mo}_${val}_${unit}`;
        const prevCount = seenActivitySignatures.get(sliceSig) || 0;
        seenActivitySignatures.set(sliceSig, prevCount + 1);
        if (prevCount > 0 && !hasExplicitSourceId) {
          flaggedDuplicateSlices.push({
            metricId: docId,
            slice: sliceSig,
            reason: 'Identical activity quantity reported in the same period without distinct invoice number. Flagged for review; aggregated in totals.'
          });
        }

        eligibleVerifiedMetrics.push(m);
      } else if (m.status === 'Submitted' || m.status === 'Under_Review') {
        submittedCount++;
      } else if (m.status === 'Rejected') {
        rejectedCount++;
      }

      if (m.evidenceDocuments && m.evidenceDocuments.length > 0) {
        evidenceAttachedCount++;
      }
    });

    // 3. Principle 6 Indicator 1: Energy Consumption (VERIFIED ENTRIES ONLY)
    let totalRenewableEnergyMWh = 0;
    let totalNonRenewableEnergyMWh = 0;

    let totalScope1_tCO2 = 0;
    let totalScope1_tCO2e_sum = 0;
    let scope1Count = 0;
    let scope1FullyQuantifiedCount = 0;

    let totalScope2_Location_tCO2 = 0;
    let totalScope2_Market_tCO2 = 0;
    let totalScope2_Reportable_tCO2 = 0;
    let scope2Count = 0;
    let scope2FullyQuantifiedCount = 0;
    let totalScope2_tCO2e_sum = 0;
    let hasMarketInstruments = false;

    eligibleVerifiedMetrics.forEach(m => {
      const co2 = m.calculatedEmissions ? (m.calculatedEmissions.co2Tonnes ?? 0) : 0;
      const energy = m.calculatedEmissions ? (m.calculatedEmissions.energyMWh || 0) : 0;
      const isRen = m.calculatedEmissions ? Boolean(m.calculatedEmissions.isRenewable) : false;

      if (isRen) {
        totalRenewableEnergyMWh += energy;
      } else {
        totalNonRenewableEnergyMWh += energy;
      }

      if (m.scope === 1) {
        scope1Count++;
        totalScope1_tCO2 += co2;
        if (m.calculatedEmissions?.co2eStatus === 'FULLY_QUANTIFIED' && m.calculatedEmissions?.co2eTonnes !== null && m.calculatedEmissions?.co2eTonnes !== undefined) {
          totalScope1_tCO2e_sum += m.calculatedEmissions.co2eTonnes;
          scope1FullyQuantifiedCount++;
        }
      } else if (m.scope === 2) {
        scope2Count++;
        const dual = m.calculatedEmissions?.scope2DualReporting;

        // Location-based Scope 2: Always aggregated from location-based grid calculation
        const locCO2 = dual?.locationBased_tCO2 !== undefined ? dual.locationBased_tCO2 : co2;
        totalScope2_Location_tCO2 += locCO2;

        // Market-based Scope 2: Independent aggregation!
        // Only entries with market-based factors or verified contractual instruments establish market instruments.
        const isMarketEntry = (m.emissionFactor?.accountingMethod === 'Market-Based') ||
          (dual?.selectedAccountingMethod === 'Market-Based') ||
          Boolean(m.calculatedEmissions?.isRenewable);

        if (isMarketEntry) {
          hasMarketInstruments = true;
        }

        // Under GHG Protocol Scope 2 Guidance, when market instruments exist:
        // contractual entries apply their instrument rate; uncovered grid power applies location proxy.
        const mktCO2 = isMarketEntry
          ? (dual?.marketBased_tCO2 !== undefined ? dual.marketBased_tCO2 : co2)
          : locCO2;
        totalScope2_Market_tCO2 += mktCO2;

        totalScope2_Reportable_tCO2 += co2;

        if (m.calculatedEmissions?.co2eStatus === 'FULLY_QUANTIFIED' && m.calculatedEmissions?.co2eTonnes !== null && m.calculatedEmissions?.co2eTonnes !== undefined) {
          totalScope2_tCO2e_sum += m.calculatedEmissions.co2eTonnes;
          scope2FullyQuantifiedCount++;
        }
      }
    });

    const isScope1AllQuantified = (scope1Count > 0 && scope1Count === scope1FullyQuantifiedCount);
    const isScope2AllQuantified = (scope2Count > 0 && scope2Count === scope2FullyQuantifiedCount);
    const scope1_tCO2e = isScope1AllQuantified ? Number(totalScope1_tCO2e_sum.toFixed(2)) : null;
    const scope2_tCO2e = isScope2AllQuantified ? Number(totalScope2_tCO2e_sum.toFixed(2)) : null;
    const totalScope1And2_tCO2e = (isScope1AllQuantified && isScope2AllQuantified)
      ? Number((totalScope1_tCO2e_sum + totalScope2_tCO2e_sum).toFixed(2))
      : null;
    const hasFullQuantification = isScope1AllQuantified && isScope2AllQuantified;

    const totalEnergyMWh = Number((totalRenewableEnergyMWh + totalNonRenewableEnergyMWh).toFixed(2));
    const totalEnergyJoules_GJ = Number((totalEnergyMWh * 3.6).toFixed(2)); // 1 MWh = 3.6 GJ
    const renewableSharePercent = totalEnergyMWh > 0 ? Number(((totalRenewableEnergyMWh / totalEnergyMWh) * 100).toFixed(2)) : 0;

    totalScope1_tCO2 = Number(totalScope1_tCO2.toFixed(2));
    totalScope2_Location_tCO2 = Number(totalScope2_Location_tCO2.toFixed(2));
    // If no market instruments exist in the reporting boundary, do NOT copy location emissions into market emissions!
    const reportedScope2_Market_tCO2 = hasMarketInstruments ? Number(totalScope2_Market_tCO2.toFixed(2)) : null;
    totalScope2_Reportable_tCO2 = Number(totalScope2_Reportable_tCO2.toFixed(2));
    const totalGHG_tCO2 = Number((totalScope1_tCO2 + totalScope2_Reportable_tCO2).toFixed(2));

    // 5. Intensity Metrics: strictly require valid denominator (turnover > 0)
    let ghgIntensityPerTurnover = null;
    let energyIntensityPerTurnover = null;
    let intensityStatus = 'CALCULATED';

    if (totalTurnoverINR_Crores !== null && totalTurnoverINR_Crores > 0) {
      ghgIntensityPerTurnover = Number((totalGHG_tCO2 / totalTurnoverINR_Crores).toFixed(4));
      energyIntensityPerTurnover = Number((totalEnergyMWh / totalTurnoverINR_Crores).toFixed(4));
    } else {
      intensityStatus = 'DENOMINATOR_UNAVAILABLE';
    }

    // SEBI BRSR Section C — Principle 6 (Environment) Structured Payload
    const brsrDisclosure = {
      meta: {
        reportingStandard: 'SEBI BRSR (Business Responsibility and Sustainability Reporting)',
        section: 'Section C: Principle-wise Performance Disclosure',
        principle: 'Principle 6: Businesses should respect and make efforts to protect and restore the environment',
        financialYear,
        reportingBoundary,
        consolidatedTurnoverCrores: totalTurnoverINR_Crores,
        turnoverStatus,
        turnoverUnavailableReason,
        generatedAt: new Date(),
        statutoryDisclaimer: 'ASSURANCE NOTICE: This system provides algorithmic aggregation and mathematical traceability in compliance with SEBI BRSR and GHG Protocol standards. It serves internal sustainability management and does NOT substitute accredited third-party statutory assurance under ISAE 3000 / AA1000.'
      },
      auditSummary: {
        totalDataPoints: allMetrics.length,
        verifiedDataPoints: verifiedCount,
        eligibleAggregatedPoints: eligibleVerifiedMetrics.length,
        duplicateRecordsSkipped: duplicateSkippedCount,
        flaggedDuplicatesForReview: flaggedDuplicateSlices,
        pendingReviewPoints: submittedCount,
        rejectedPoints: rejectedCount,
        evidenceAttachmentRate: allMetrics.length > 0 ? Number(((evidenceAttachedCount / allMetrics.length) * 100).toFixed(1)) : 0,
        assuranceReadiness: verifiedCount === allMetrics.length && allMetrics.length > 0 ? 'Full Expert Verification Complete' : 'Partial / Under Review'
      },
      essentialIndicator1_Energy: {
        title: 'Essential Indicator 1: Details of total energy consumption and energy intensity',
        unit: 'MWh and GigaJoules (GJ)',
        table: {
          currentFY: financialYear,
          renewableEnergy_MWh: Number(totalRenewableEnergyMWh.toFixed(2)),
          nonRenewableEnergy_MWh: Number(totalNonRenewableEnergyMWh.toFixed(2)),
          totalEnergy_MWh: totalEnergyMWh,
          totalEnergy_GJ: totalEnergyJoules_GJ,
          renewableEnergyPercentage: renewableSharePercent,
          energyIntensityPerTurnoverCrores: energyIntensityPerTurnover,
          intensityStatus,
          intensityUnit: energyIntensityPerTurnover !== null ? 'MWh / INR Crore turnover' : 'N/A (Turnover data unavailable)'
        }
      },
      essentialIndicator4_GHG: {
        title: 'Essential Indicator 4: Details of greenhouse gas emissions (Scope 1 and Scope 2) & its intensity',
        unit: 'Metric Tonnes of CO2 (tCO2)',
        gasCoverage: hasFullQuantification ? 'CO2E_GHG_SUM' : 'CO2_ONLY',
        gasCoverageNote: hasFullQuantification
          ? 'Includes fully quantified greenhouse gas inventory across CO2, CH4, and N2O.'
          : 'CO2_ONLY: Primary factors (CEA India Grid v19 and IPCC stationary combustion tables) model pure CO2 stack emissions. Non-CO2 GHGs (CH4, N2O) are unquantified and NOT reported as CO2e.',
        table: {
          currentFY: financialYear,
          scope1_tCO2: totalScope1_tCO2,
          // When gasCoverage is CO2_ONLY, co2e is strictly null (never falsely labeled as CO2e)
          scope1_tCO2e: scope1_tCO2e,
          scope2_LocationBased_tCO2: totalScope2_Location_tCO2,
          scope2_MarketBased_tCO2: reportedScope2_Market_tCO2,
          scope2_MarketBasedStatus: hasMarketInstruments ? 'REPORTED' : 'UNAVAILABLE',
          scope2_MarketBasedNote: hasMarketInstruments
            ? 'Aggregated from verified contractual instruments and captive generation.'
            : 'Unavailable: No contractual instruments, PPAs, or supplier-specific emission rates claimed for this period, and no residual mix is published for the Indian grid.',
          scope2_Reportable_tCO2: totalScope2_Reportable_tCO2,
          scope2_LocationBased_tCO2e: scope2_tCO2e,
          scope2_MarketBased_tCO2e: scope2_tCO2e,
          scope2_tCO2e: scope2_tCO2e,
          totalScope1And2_tCO2: totalGHG_tCO2,
          totalScope1And2_tCO2e: totalScope1And2_tCO2e,
          ghgIntensityPerTurnoverCrores: ghgIntensityPerTurnover,
          intensityUnit: ghgIntensityPerTurnover !== null ? 'tCO2 / INR Crore turnover' : 'N/A (Turnover data unavailable)',
          intensityStatus,
          turnoverStatus,
          independentAssuranceStatus: verifiedCount > 0 ? 'Verified by Internal Human ESG Experts' : 'Pending Verification'
        }
      },
      scope3Disclosure: {
        title: 'Scope 3 Disclosures',
        status: 'Extensible Schema (Phase 2 Roadmap)',
        declaration: 'Scope 3 greenhouse gas figures are not reported in this prototype. System database schema is fully aligned with GHG Protocol Corporate Value Chain Standard for future onboarding.'
      },
      rawDataTrace: eligibleVerifiedMetrics
    };

    return brsrDisclosure;
};

exports.buildBRSRDisclosure = buildBRSRDisclosure;

exports.getBRSRSectionC = async (req, res) => {
  try {
    const brsrDisclosure = await buildBRSRDisclosure(req.user, req.query);
    res.json({ success: true, brsrDisclosure });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.downloadBRSRPdf = async (req, res) => {
  try {
    const brsrDisclosure = await buildBRSRDisclosure(req.user, req.query);
    const pdfBuffer = generateBRSRReportPdf(brsrDisclosure);

    const safeFY = (brsrDisclosure.meta?.financialYear || 'FY_2024-25').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeBoundary = (brsrDisclosure.meta?.reportingBoundary || 'MEIL_Group').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `MEIL_BRSR_Section_C_${safeFY}_${safeBoundary}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    res.send(pdfBuffer);
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.getScope3Roadmap = (req, res) => {
  res.json({
    success: true,
    data: getScope3Status()
  });
};
