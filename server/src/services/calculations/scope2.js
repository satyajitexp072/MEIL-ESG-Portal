/**
 * Scope 2 Calculation Engine (Indirect Emissions from Purchased Electricity)
 * 
 * Strict Methodology Controls:
 * 1. Dual Reporting (GHG Protocol Scope 2 Guidance): Preserves BOTH Location-Based and Market-Based figures.
 * 2. CEA Grid Factor Applicability & Reporting Period Alignment:
 *    - 0.716 tCO2/MWh is the published national weighted-average grid emission factor (inclusive of RES)
 *      from the Central Electricity Authority (CEA) CO2 Baseline Database for the Indian Power Sector,
 *      User Guide Version 19.0 (published December 2023).
 *    - Period-Specific Applicability: 0.716 tCO2/MWh specifically reflects the generation mix for
 *      Financial Year 2022–23 (1 April 2022 to 31 March 2023).
 *    - Regulatory Boundary: It is NOT the universal factor for every reporting period, nor is Version 19.0
 *      universally or permanently mandated by SEBI BRSR. Under BRSR guidance, reporting entities must
 *      align their grid emission factor with the specific Financial Year being disclosed (e.g. FY 2021–22
 *      uses CEA v18.0 at 0.714 tCO2/MWh; FY 2022–23 uses CEA v19.0 at 0.716 tCO2/MWh; future years require
 *      subsequent annual CEA database releases once officially ratified).
 *    - Demonstration Baseline: 0.716 tCO2/MWh is preserved as the active benchmark factor for the prototype's
 *      FY 2022–23 / FY 2023–24 baseline dataset. In multi-period disclosures, the factor must be selected based
 *      on the entry's reportingPeriod.financialYear. The factor value is not changed silently.
 * 3. Gas Coverage Integrity: CEA Baseline Database reports CO2 only (0.716 tCO2/MWh). Does NOT label as CO2e.
 * 4. Evidence & Reviewer Verification Mandate: Zero-emission claims require actual supporting evidence
 *    AND reviewer approval; metadata flags alone CANNOT establish zero emissions.
 */

const ALLOWED_ELECTRICITY_UNITS = ['kwh', 'mwh', 'gwh', 'units', 'unit'];

// Central Electricity Authority (CEA) India National Grid Factor for FY 2022-23 generation mix (User Guide v19.0)
const NATIONAL_GRID_BASELINE_FACTOR = 0.716; // tCO2/MWh (CO2 only, published Dec 2023 for FY 2022-23)

function calculateScope2(activityValue, activityUnit, factor, context = {}) {
  if (activityValue === null || activityValue === undefined || isNaN(activityValue)) {
    throw new Error('Activity data quantity must be a valid numeric value.');
  }

  const numValue = Number(activityValue);
  if (numValue < 0) {
    throw new Error('Activity data quantity cannot be negative.');
  }

  if (!activityUnit || typeof activityUnit !== 'string' || activityUnit.trim() === '') {
    throw new Error('Activity data unit is required.');
  }

  if (!factor) {
    throw new Error('Emission factor reference document is required.');
  }

  const unitClean = activityUnit.trim().toLowerCase();
  if (!ALLOWED_ELECTRICITY_UNITS.includes(unitClean)) {
    throw new Error(
      `Unsupported activity unit "${activityUnit}" for Scope 2 electricity. Allowed units are: kWh, MWh, GWh, Units (1 Unit = 1 kWh).`
    );
  }

  // Normalization to MWh
  let mwhValue = numValue;
  let unitConversionText = null;

  if (unitClean === 'kwh' || unitClean === 'units' || unitClean === 'unit') {
    mwhValue = numValue / 1000;
    unitConversionText = `Normalized ${numValue.toLocaleString()} kWh to ${mwhValue.toLocaleString()} MWh (/ 1,000)`;
  } else if (unitClean === 'gwh') {
    mwhValue = numValue * 1000;
    unitConversionText = `Normalized ${numValue.toLocaleString()} GWh to ${mwhValue.toLocaleString()} MWh (× 1,000)`;
  }

  // Factor Unit Compatibility Check
  if (!factor.factorUnit || typeof factor.factorUnit !== 'string') {
    throw new Error('Emission factor unit is required.');
  }
  const factorUnitLower = factor.factorUnit.trim().toLowerCase();
  if (factorUnitLower.includes('liter') || factorUnitLower.includes('kl') || factorUnitLower.includes('scm') || factorUnitLower.includes('nm3') || (factorUnitLower.includes('/mt') && !factorUnitLower.includes('mwh'))) {
    throw new Error(`Incompatible factor unit "${factor.factorUnit}" for Scope 2 electricity. Scope 2 factors must be electricity energy-based (e.g. tCO2/MWh, kg CO2/kWh).`);
  }

  // Validate unitConversionMultiplier against factorUnit
  const multiplier = factor.unitConversionMultiplier !== undefined ? factor.unitConversionMultiplier : 1.0;
  if (typeof multiplier !== 'number' || multiplier <= 0) {
    throw new Error(`Invalid unitConversionMultiplier "${multiplier}". Must be a positive numeric value.`);
  }

  const isKgFactorUnit = factorUnitLower.startsWith('kg co2') || factorUnitLower.startsWith('kg co2e');
  const isTonneFactorUnit = factorUnitLower.startsWith('tco2') || factorUnitLower.startsWith('tco2e') || factorUnitLower.startsWith('tonne');

  if (isKgFactorUnit && Math.abs(multiplier - 0.001) > 1e-6) {
    throw new Error(
      `Invalid unit conversion multiplier: factorUnit "${factor.factorUnit}" expresses kg CO2 and requires a multiplier of 0.001 to yield metric tonnes (tCO2), but factor specifies ${multiplier}.`
    );
  }
  if (isTonneFactorUnit && Math.abs(multiplier - 1.0) > 1e-6) {
    throw new Error(
      `Invalid unit conversion multiplier: factorUnit "${factor.factorUnit}" expresses tCO2 and requires a multiplier of 1.0 to yield metric tonnes (tCO2), but factor specifies ${multiplier}.`
    );
  }

  const energyMWh = Number(mwhValue.toFixed(4));
  const factorValue = factor.factorValue;
  const gasCoverage = factor.gasCoverage || 'CO2_ONLY';

  // 1. Dual Reporting: Location-Based Calculation (Always calculated)
  const locationBased_tCO2 = Number((mwhValue * NATIONAL_GRID_BASELINE_FACTOR).toFixed(4));

  // 2. Dual Reporting: Market-Based Calculation & Zero-Emission Claim Verification
  const isMarketFactor = (factor.accountingMethod === 'Market-Based');
  const isZeroClaim = (factorValue === 0.0);
  const selectedAccountingMethod = isMarketFactor ? 'Market-Based' : 'Location-Based';

  let marketBased_tCO2 = locationBased_tCO2;
  let marketClaimStatus = 'LOCATION_APPLIED';
  let isRenewable = false;

  if (isZeroClaim) {
    if (!isMarketFactor) {
      throw new Error(
        'Regulatory Integrity Violation: Zero Scope 2 emissions cannot be assigned under Location-Based grid accounting. Under GHG Protocol Scope 2 Guidance, zero emissions is only applicable under the Market-Based method with verified contractual or captive generation instruments.'
      );
    }

    // Context validation: Server-derived qualifying evidence AND authorized reviewer approval
    // Client-supplied flags are strictly ignored; context must provide server-verified flags
    const hasQualifyingEvidence = Boolean(context.hasQualifyingEvidence);
    const isVerifiedScope2Claim = Boolean(context.isVerifiedScope2Claim);
    const isPeriodValid = (context.isPeriodValid !== undefined) ? Boolean(context.isPeriodValid) : true;
    const isRejected = Boolean(context.isRejected);
    const isPreview = Boolean(context.isPreview);

    let coveredMWh = 0;
    let uncoveredMWh = mwhValue;

    if (isPreview) {
      // Preview mode cannot grant statutory verified zero status without persisted evidence and audit
      marketBased_tCO2 = locationBased_tCO2;
      marketClaimStatus = 'PREVIEW_UNVERIFIED_PROXY';
      isRenewable = false;
    } else if (isRejected) {
      // Claim was explicitly rejected by reviewer
      marketBased_tCO2 = locationBased_tCO2;
      marketClaimStatus = 'CLAIM_REJECTED_PROXY';
      isRenewable = false;
    } else if (!isPeriodValid) {
      // Instrument is outside the reporting period
      marketBased_tCO2 = locationBased_tCO2;
      marketClaimStatus = 'INSTRUMENT_PERIOD_MISMATCH_PROXY';
      isRenewable = false;
    } else if (hasQualifyingEvidence && isVerifiedScope2Claim) {
      // Check for partial vs complete coverage
      const specifiedCovered = (context.coveredQuantityMWh !== undefined && context.coveredQuantityMWh !== null)
        ? Number(context.coveredQuantityMWh)
        : mwhValue; // default to complete coverage if not specified

      coveredMWh = Math.min(mwhValue, Math.max(0, specifiedCovered));
      uncoveredMWh = Math.max(0, mwhValue - coveredMWh);

      if (coveredMWh >= mwhValue) {
        // Complete coverage: entire volume achieves 0.00 tCO2
        marketBased_tCO2 = 0.0;
        marketClaimStatus = 'VERIFIED_ZERO';
        isRenewable = true;
      } else if (coveredMWh > 0) {
        // Partial coverage: Covered portion is 0.00 tCO2; uncovered portion uses location grid factor
        const uncovered_tCO2 = Number((uncoveredMWh * NATIONAL_GRID_BASELINE_FACTOR).toFixed(4));
        marketBased_tCO2 = uncovered_tCO2;
        marketClaimStatus = 'PARTIAL_COVERAGE_VERIFIED';
        isRenewable = true; // partial renewable credit
      } else {
        // Zero covered quantity
        marketBased_tCO2 = locationBased_tCO2;
        marketClaimStatus = 'UNVERIFIED_MISSING_EVIDENCE_PROXY';
        isRenewable = false;
      }
    } else {
      // Claim lacks qualifying evidence or specific claim audit approval
      // In accordance with GHG Protocol Scope 2 Quality Criteria, unverified contractual claims
      // CANNOT be granted 0 emissions; location grid baseline applies as proxy.
      marketBased_tCO2 = locationBased_tCO2;
      marketClaimStatus = !hasQualifyingEvidence ? 'UNVERIFIED_MISSING_EVIDENCE_PROXY' : 'UNVERIFIED_PENDING_APPROVAL_PROXY';
      isRenewable = false;
    }
  } else if (isMarketFactor) {
    // Non-zero Market-Based Factor (e.g. Specific PPA, Green Tariff, or Supplier-Specific Factor)
    marketBased_tCO2 = Number((mwhValue * factorValue * multiplier).toFixed(4));
    marketClaimStatus = 'MARKET_SPECIFIC_APPLIED';
    isRenewable = Boolean(factor.isRenewable);
  }

  // Explicit Selection of Reportable Figure (Resolves non-zero market factor headline representation)
  let reportable_tCO2 = locationBased_tCO2;
  if (isMarketFactor) {
    if (isZeroClaim) {
      if (marketClaimStatus === 'VERIFIED_ZERO') {
        reportable_tCO2 = 0.0;
      } else if (marketClaimStatus === 'PARTIAL_COVERAGE_VERIFIED') {
        reportable_tCO2 = marketBased_tCO2;
      } else {
        reportable_tCO2 = locationBased_tCO2;
      }
    } else {
      // Non-zero market factor: reportable figure is the specific market result
      reportable_tCO2 = marketBased_tCO2;
    }
  } else {
    reportable_tCO2 = locationBased_tCO2;
  }

  const co2Tonnes = reportable_tCO2;
  // CO2 vs CO2e Data Model: If CO2_ONLY, co2eTonnes is explicitly null to avoid claiming unmodeled non-CO2 GHGs
  const co2eTonnes = (gasCoverage === 'CO2E_GHG_SUM') ? co2Tonnes : null;
  const co2eStatus = (gasCoverage === 'CO2E_GHG_SUM') ? 'FULLY_QUANTIFIED' : 'NOT_QUANTIFIED_CO2_ONLY';

  const steps = [
    `1. Electricity Activity: ${numValue.toLocaleString()} ${activityUnit}`
  ];

  if (unitConversionText) {
    steps.push(`2. Unit Normalization: ${unitConversionText}`);
  }

  steps.push(
    `3. Dual Reporting Location-Based Baseline: ${mwhValue.toFixed(4)} MWh × ${NATIONAL_GRID_BASELINE_FACTOR} tCO2/MWh = ${locationBased_tCO2} tCO2 (CEA v19, FY 2022-23 generation mix, CO2 strictly)`,
    `4. Selected Accounting Method: ${selectedAccountingMethod} (Reportable: ${reportable_tCO2} tCO2)`,
    `5. Factor Gas Coverage: ${gasCoverage === 'CO2_ONLY' ? 'CO2 strictly (Central Electricity Authority does not model non-CO2 GHGs; CO2e unestablished)' : 'CO2e'}`
  );

  if (isZeroClaim) {
    if (marketClaimStatus === 'VERIFIED_ZERO') {
      steps.push(
        `6. Market-Based Audit: Verified Onsite Captive / PPA claim with qualifying contractual/telemetry evidence and auditor claim sign-off. Market Emissions: 0.00 tCO2.`,
        `7. BRSR Principle 6 Indicator 1 Credit: ${energyMWh.toLocaleString()} MWh counted as Renewable Energy.`
      );
    } else {
      steps.push(
        `6. Market-Based Audit Status: ${marketClaimStatus === 'PREVIEW_UNVERIFIED_PROXY' ? 'Preview calculation cannot grant verified zero emissions without persisted evidence and auditor sign-off' : marketClaimStatus === 'UNVERIFIED_MISSING_EVIDENCE_PROXY' ? 'Zero claim lacks qualifying contractual instrument / SCADA evidence' : 'Zero claim awaiting auditor sign-off'}.`,
        `7. Conservative Accounting Fallback: Location-based grid factor proxy applied (${locationBased_tCO2} tCO2) until verified evidence is approved.`
      );
    }
  } else if (isMarketFactor) {
    steps.push(
      `6. Market-Based Specific Factor Applied: ${mwhValue.toFixed(4)} MWh × ${factorValue} ${factor.factorUnit} = ${marketBased_tCO2} tCO2 (Dual Location Baseline: ${locationBased_tCO2} tCO2).`
    );
  }

  const formulaApplied = isRenewable
    ? `Market-Based Verified: ${mwhValue.toFixed(2)} MWh × 0.00 tCO2/MWh = 0.00 tCO2 (Dual Reporting Location Baseline: ${locationBased_tCO2} tCO2)`
    : isMarketFactor && !isZeroClaim
    ? `Market-Based Applied: ${mwhValue.toFixed(2)} MWh × ${factorValue} ${factor.factorUnit} = ${marketBased_tCO2} tCO2 (Dual Reporting Location Baseline: ${locationBased_tCO2} tCO2)`
    : `Emissions = ${mwhValue.toFixed(2)} MWh × ${NATIONAL_GRID_BASELINE_FACTOR} tCO2/MWh = ${locationBased_tCO2} tCO2 [Location-Based Grid Baseline]`;

  return {
    co2Tonnes,
    co2eTonnes,
    co2eStatus,
    gasCoverage,
    energyMWh,
    isRenewable,
    scope2DualReporting: {
      locationBased_tCO2,
      marketBased_tCO2,
      selectedAccountingMethod,
      reportable_tCO2,
      marketClaimStatus
    },
    formulaApplied,
    calculationSteps: steps
  };
}

module.exports = { calculateScope2, ALLOWED_ELECTRICITY_UNITS, NATIONAL_GRID_BASELINE_FACTOR };
