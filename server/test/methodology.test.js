const { calculateScope1 } = require('../src/services/calculations/scope1');
const { calculateScope2, NATIONAL_GRID_BASELINE_FACTOR } = require('../src/services/calculations/scope2');
const { calculateEmissions } = require('../src/services/calculations/index');
const { runSafeMigration } = require('../src/seeds/update-factors-safe');

async function runMethodologyTests() {
  console.log('\n================================================================');
  console.log(' RUNNING STAGE B: COMPREHENSIVE REGULATORY METHODOLOGY TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  function assertThrows(fn, expectedSubstr, testName) {
    try {
      fn();
      console.error(`[FAIL] ${testName} - Expected error containing "${expectedSubstr}" but function did not throw`);
      failed++;
    } catch (err) {
      if (err.message && err.message.includes(expectedSubstr)) {
        console.log(`[PASS] ${testName}`);
        passed++;
      } else {
        console.error(`[FAIL] ${testName} - Expected error containing "${expectedSubstr}" but got: "${err.message}"`);
        failed++;
      }
    }
  }

  // --- Fixtures ---
  const dieselStationaryFactor = {
    scope: 1,
    factorCode: 'DIESEL_HSD_STATIONARY_DG',
    fuelIdentifier: 'DIESEL_HSD',
    fuelOrGridType: 'Diesel',
    category: 'Liquid Fuel',
    subCategory: 'Diesel Generator (Stationary Combustion)',
    factorValue: 2.686,
    factorUnit: 'kg CO2/liter',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 0.001,
    sourceCitation: 'IPCC 2006 Vol 2 Ch 1 Table 1.2 & Ch 2 Table 2.2',
    publicationYear: 2006
  };

  const gasPipelineFactor = {
    scope: 1,
    factorCode: 'NATURAL_GAS_PIPELINE_STATIONARY',
    fuelIdentifier: 'NATURAL_GAS_PIPELINE',
    fuelOrGridType: 'Natural Gas',
    category: 'Gaseous Fuel',
    subCategory: 'Pipeline Gas & Boilers',
    factorValue: 1.979,
    factorUnit: 'kg CO2/SCM',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 0.001,
    sourceCitation: 'IPCC 2006 Vol 2 Ch 2 Table 2.2; GAIL / PNGRB',
    publicationYear: 2006
  };

  const coalG7Factor = {
    scope: 1,
    factorCode: 'COAL_INDUSTRIAL_G7_BOILER',
    fuelIdentifier: 'COAL_INDUSTRIAL_G7',
    fuelOrGridType: 'Coal',
    category: 'Solid Fuel',
    subCategory: 'Industrial Boilers and Kilns',
    factorValue: 1.850,
    factorUnit: 'tCO2/Metric Tonne',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 1.0,
    sourceCitation: 'IPCC 2006 Vol 2 Ch 2 Table 2.2; CMPDI Grade G7',
    publicationYear: 2006
  };

  const coalG11Factor = {
    scope: 1,
    factorCode: 'COAL_POWER_G11_UTILITY',
    fuelIdentifier: 'COAL_POWER_G11',
    fuelOrGridType: 'Coal',
    category: 'Solid Fuel',
    subCategory: 'Thermal Power Plant Coal',
    factorValue: 1.605,
    factorUnit: 'tCO2/Metric Tonne',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 1.0,
    sourceCitation: 'IPCC 2006 Vol 2 Ch 2 Table 2.2; CMPDI Grade G11',
    publicationYear: 2006
  };

  const petrolCommercialFactor = {
    scope: 1,
    factorCode: 'MOTOR_GASOLINE_LIGHT_FLEET',
    fuelIdentifier: 'MOTOR_GASOLINE',
    fuelOrGridType: 'Petrol',
    category: 'Liquid Fuel',
    subCategory: 'Light Duty Passenger Fleet',
    factorValue: 2.310,
    factorUnit: 'kg CO2/liter',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 0.001,
    sourceCitation: 'IPCC 2006 Vol 2 Ch 1 Table 1.2 & Ch 3 Table 3.2.1; Commercial Density 0.7524 kg/L',
    publicationYear: 2006
  };

  const petrolBisFactor = {
    scope: 1,
    factorCode: 'MOTOR_GASOLINE_BIS_IS2796',
    fuelIdentifier: 'MOTOR_GASOLINE',
    fuelOrGridType: 'Petrol',
    category: 'Liquid Fuel',
    subCategory: 'Light Duty Fleet (BIS Minimum Density)',
    factorValue: 2.278,
    factorUnit: 'kg CO2/liter',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 0.001,
    density: { value: 0.742, unit: 'kg/L' },
    sourceCitation: 'IPCC 2006 Vol 2 Ch 1 Table 1.2 & Ch 3 Table 3.2.1; BIS IS 2796 (density 0.742 kg/L)',
    publicationYear: 2006
  };

  const ceaGridFactor = {
    scope: 2,
    factorCode: 'GRID_ELECTRICITY_IN_CEA_V19',
    fuelIdentifier: 'GRID_ELECTRICITY_IN',
    fuelOrGridType: 'Grid Electricity',
    category: 'Purchased Electricity',
    subCategory: 'National Grid Average (Location-Based)',
    factorValue: 0.716,
    factorUnit: 'tCO2/MWh',
    gasCoverage: 'CO2_ONLY',
    accountingMethod: 'Location-Based',
    unitConversionMultiplier: 1.0,
    sourceCitation: 'Central Electricity Authority (CEA) v19',
    publicationYear: 2024
  };

  const nonZeroMarketPPAFactor = {
    scope: 2,
    factorCode: 'PPA_WIND_SOLAR_HYBRID',
    fuelIdentifier: 'GRID_ELECTRICITY_IN',
    fuelOrGridType: 'Grid Electricity',
    category: 'Purchased Electricity',
    subCategory: 'Dedicated Hybrid PPA with Residual Grid Backup',
    factorValue: 0.350,
    factorUnit: 'tCO2/MWh',
    gasCoverage: 'CO2_ONLY',
    accountingMethod: 'Market-Based',
    unitConversionMultiplier: 1.0,
    sourceCitation: 'Specific Corporate PPA Contract Schedule B',
    publicationYear: 2024
  };

  const captiveSolarFactor = {
    scope: 2,
    factorCode: 'SOLAR_CAPTIVE_ONSITE_MARKET',
    fuelIdentifier: 'SOLAR_CAPTIVE_ONSITE',
    fuelOrGridType: 'Solar Power',
    category: 'Purchased Electricity',
    subCategory: 'On-site Behind-the-Meter Captive Solar',
    factorValue: 0.0,
    factorUnit: 'tCO2/MWh',
    gasCoverage: 'CO2_ONLY',
    accountingMethod: 'Market-Based',
    unitConversionMultiplier: 1.0,
    contractualInstrumentRequired: true,
    sourceCitation: 'GHG Protocol Scope 2 Market-Based Guidance',
    publicationYear: 2015
  };

  // --- SECTION 1: Independent First-Principles Calculations ---
  console.log('--- 1. Testing First-Principles Independent Calculations ---');
  // Diesel 10,000 L: 10,000 * 2.686 * 0.001 = 26.86 tCO2; Energy = (10,000 * 0.843 kg/L * 43.0 MJ/kg) / 3600 MJ/MWh = 100.6917 MWh
  const dRes = calculateScope1(10000, 'Liters', dieselStationaryFactor);
  assert(dRes.co2Tonnes === 26.86, 'Diesel 10,000 L yields exact 26.86 tCO2', `got ${dRes.co2Tonnes}`);
  assert(Math.abs(dRes.energyMWh - 100.69) < 0.01, 'Diesel primary energy independently calculated (100.69 MWh)');

  // Natural Gas 10,000 SCM: 10,000 * 1.979 * 0.001 = 19.79 tCO2; Energy = (10,000 * 35.28 MJ/SCM) / 3600 = 98.0 MWh
  const gRes = calculateScope1(10000, 'SCM', gasPipelineFactor);
  assert(gRes.co2Tonnes === 19.79, 'Natural Gas 10,000 SCM yields exact 19.79 tCO2', `got ${gRes.co2Tonnes}`);
  assert(gRes.energyMWh === 98.00, 'Natural Gas primary energy independently calculated (98.00 MWh)');

  // Coal Grade G7 100 MT: 100 * 1.850 = 185.0 tCO2; Energy = (100 * 19.25 * 1000) / 3600 = 534.72 MWh
  const c7Res = calculateScope1(100, 'Metric Tonnes', coalG7Factor);
  assert(c7Res.co2Tonnes === 185.0, 'Coal Grade G7 100 MT yields exact 185.0 tCO2', `got ${c7Res.co2Tonnes}`);
  assert(Math.abs(c7Res.energyMWh - 534.72) < 0.01, 'Coal Grade G7 primary energy independently calculated (534.72 MWh)');

  // Coal Grade G11 100 MT: 100 * 1.605 = 160.5 tCO2; Energy = (100 * 16.70 * 1000) / 3600 = 463.89 MWh
  const c11Res = calculateScope1(100, 'Metric Tonnes', coalG11Factor);
  assert(c11Res.co2Tonnes === 160.5, 'Coal Grade G11 100 MT yields exact 160.5 tCO2', `got ${c11Res.co2Tonnes}`);
  assert(Math.abs(c11Res.energyMWh - 463.89) < 0.01, 'Coal Grade G11 primary energy independently calculated (463.89 MWh)');

  // Petrol Standard Commercial (Density 0.7524 kg/L, Factor 2.310 kg CO2/L):
  // 5,000 L: 5,000 * 2.310 * 0.001 = 11.55 tCO2; Energy = (5,000 * 33.333 MJ/L) / 3600 = 46.2958 MWh
  const pCommRes = calculateScope1(5000, 'Liters', petrolCommercialFactor);
  assert(pCommRes.co2Tonnes === 11.55, 'Petrol (Commercial 0.752 kg/L) 5,000 L yields exact 11.55 tCO2', `got ${pCommRes.co2Tonnes}`);
  assert(Math.abs(pCommRes.energyMWh - 46.295) < 0.02, 'Petrol (Commercial 0.752 kg/L) primary energy independently calculated (46.30 MWh)', `got ${pCommRes.energyMWh}`);
  const commRatio = pCommRes.co2Tonnes / pCommRes.energyMWh;
  assert(Math.abs(commRatio - 0.24948) < 0.0005, 'Petrol commercial emissions-to-energy ratio strictly equals IPCC constant (0.24948 tCO2/MWh)');

  // Petrol BIS IS 2796 Minimum Benchmark (Density 0.742 kg/L, Factor 2.278 kg CO2/L):
  // 5,000 L: 5,000 * 2.278 * 0.001 = 11.39 tCO2; Energy = (5,000 * 32.871 MJ/L) / 3600 = 45.655 MWh
  const pBisRes = calculateScope1(5000, 'Liters', petrolBisFactor);
  assert(pBisRes.co2Tonnes === 11.39, 'Petrol (BIS IS 2796 0.742 kg/L) 5,000 L yields exact 11.39 tCO2', `got ${pBisRes.co2Tonnes}`);
  assert(Math.abs(pBisRes.energyMWh - 45.655) < 0.01, 'Petrol (BIS IS 2796 0.742 kg/L) primary energy independently calculated (45.655 MWh)', `got ${pBisRes.energyMWh}`);
  const bisRatio = pBisRes.co2Tonnes / pBisRes.energyMWh;
  assert(Math.abs(bisRatio - 0.24948) < 0.0005, 'Petrol BIS variant emissions-to-energy ratio strictly equals IPCC constant (0.24948 tCO2/MWh)');

  // REGRESSION TEST: Catch density mismatch between emissions factor and primary energy
  // If factor 2.310 (density 0.752) is mistakenly paired with energy 45.655 MWh (density 0.742), the ratio deviates by +1.4%
  const mismatchedRatio = 11.55 / 45.655; // 0.25298 tCO2/MWh
  assert(Math.abs(mismatchedRatio - 0.24948) > 0.003, 'Regression Test: Successfully flags cross-density mismatch (11.55 tCO2 vs 45.655 MWh ratio error > 1.4%)');

  // --- SECTION 2: CO2 vs CO2e Representation & Data Model ---
  console.log('\n--- 2. Testing CO2 vs CO2e Data Model Integrity ---');
  assert(dRes.gasCoverage === 'CO2_ONLY', 'Diesel factor gas coverage is strictly CO2_ONLY');
  assert(dRes.co2Tonnes === 26.86, 'co2Tonnes contains pure CO2 mass (26.86)');
  assert(dRes.co2eTonnes === null, 'co2eTonnes is explicitly null when gasCoverage is CO2_ONLY (prohibits false CO2e equivalence)');
  assert(dRes.co2eStatus === 'NOT_QUANTIFIED_CO2_ONLY', 'co2eStatus explicitly records NOT_QUANTIFIED_CO2_ONLY');

  // Verify full GHG factor with CO2e coverage
  const fullGhgFactor = {
    scope: 1,
    factorCode: 'DIESEL_FULL_GHG_IPCC',
    fuelIdentifier: 'DIESEL_HSD',
    fuelOrGridType: 'Diesel',
    category: 'Liquid Fuel',
    subCategory: 'Full GHG Inventory',
    factorValue: 2.705,
    factorUnit: 'kg CO2e/liter',
    gasCoverage: 'CO2E_GHG_SUM',
    unitConversionMultiplier: 0.001,
    sourceCitation: 'IPCC 2006 Vol 2 Tables 2.2, 2.4, 2.5 with AR5 GWPs',
    publicationYear: 2006
  };
  const fullGhgRes = calculateScope1(10000, 'Liters', fullGhgFactor);
  assert(fullGhgRes.co2eTonnes === 27.05, 'Supported CO2e factor populates co2eTonnes (27.05 tCO2e)');
  assert(fullGhgRes.co2eStatus === 'FULLY_QUANTIFIED', 'co2eStatus records FULLY_QUANTIFIED for full GHG factor');

  // --- SECTION 3: Factor-Unit and Multiplier Compatibility ---
  console.log('\n--- 3. Testing Factor-Unit and Multiplier Compatibility ---');
  // Rejects factor with mismatched factorUnit
  const invalidUnitFactor1 = { ...dieselStationaryFactor, factorUnit: 'kg CO2/SCM' };
  assertThrows(() => calculateScope1(100, 'Liters', invalidUnitFactor1), 'Incompatible factor unit', 'Rejects gaseous factor unit (SCM) on liquid diesel');

  const invalidUnitFactor2 = { ...coalG7Factor, factorUnit: 'tCO2/MWh' };
  assertThrows(() => calculateScope1(100, 'Metric Tonnes', invalidUnitFactor2), 'Incompatible factor unit', 'Rejects electricity factor unit (MWh) on coal');

  const invalidUnitFactor3 = { ...ceaGridFactor, factorUnit: 'kg CO2/liter' };
  assertThrows(() => calculateScope2(100, 'kWh', invalidUnitFactor3), 'Incompatible factor unit', 'Rejects liquid factor unit (liter) on electricity');

  // Rejects factor with invalid unitConversionMultiplier
  const invalidMultFactor1 = { ...dieselStationaryFactor, unitConversionMultiplier: 1.0 }; // kg factor must be 0.001
  assertThrows(() => calculateScope1(100, 'Liters', invalidMultFactor1), 'Invalid unit conversion multiplier', 'Rejects kg factor with multiplier 1.0');

  const invalidMultFactor2 = { ...coalG7Factor, unitConversionMultiplier: 0.001 }; // tCO2 factor must be 1.0
  assertThrows(() => calculateScope1(100, 'Metric Tonnes', invalidMultFactor2), 'Invalid unit conversion multiplier', 'Rejects tonne factor with multiplier 0.001');

  const negativeMultFactor = { ...dieselStationaryFactor, unitConversionMultiplier: -0.001 };
  assertThrows(() => calculateScope1(100, 'Liters', negativeMultFactor), 'Must be a positive numeric value', 'Rejects negative conversion multiplier');

  // --- SECTION 4: Scope 2 Reported-Result Engine Logic ---
  console.log('\n--- 4. Testing Scope 2 Reported-Result Engine Logic ---');
  // Location-based calculation
  const s2LocRes = calculateScope2(100000, 'kWh', ceaGridFactor);
  assert(s2LocRes.scope2DualReporting.selectedAccountingMethod === 'Location-Based', 'Grid factor sets selectedAccountingMethod = Location-Based');
  assert(s2LocRes.co2Tonnes === 71.6, 'Location headline co2Tonnes equals 71.6 tCO2');
  assert(s2LocRes.scope2DualReporting.locationBased_tCO2 === 71.6, 'locationBased_tCO2 is 71.6 tCO2');
  assert(s2LocRes.scope2DualReporting.marketBased_tCO2 === 71.6, 'marketBased_tCO2 uses location proxy in absence of market contract');

  // Non-zero Market-Based Factor: result differs from location-based baseline!
  const s2MarketRes = calculateScope2(100000, 'kWh', nonZeroMarketPPAFactor);
  assert(s2MarketRes.scope2DualReporting.selectedAccountingMethod === 'Market-Based', 'Market factor sets selectedAccountingMethod = Market-Based');
  assert(s2MarketRes.scope2DualReporting.locationBased_tCO2 === 71.6, 'Dual reporting preserves location baseline (71.6 tCO2)');
  assert(s2MarketRes.scope2DualReporting.marketBased_tCO2 === 35.0, 'marketBased_tCO2 equals 35.0 tCO2 (100 MWh × 0.350)');
  assert(s2MarketRes.co2Tonnes === 35.0, 'Headline co2Tonnes explicitly reports market result (35.0 tCO2), NOT location baseline (71.6)');
  assert(s2MarketRes.scope2DualReporting.marketClaimStatus === 'MARKET_SPECIFIC_APPLIED', 'marketClaimStatus is MARKET_SPECIFIC_APPLIED');

  // --- SECTION 5: Scope 2 Contractual Coverage & Zero-Emission Negative Security Tests ---
  console.log('\n--- 5. Testing Scope 2 Contractual Coverage: 8 Regulatory Cases & Spoof Resistance ---');
  
  // Case 1: No contractual instrument attached
  const case1Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: false,
    isVerifiedScope2Claim: false
  });
  assert(case1Res.co2Tonnes === 71.6, 'Case 1 (No Instrument): Falls back to location grid proxy (71.6 tCO2)');
  assert(case1Res.scope2DualReporting.marketClaimStatus === 'UNVERIFIED_MISSING_EVIDENCE_PROXY', 'Case 1: Flagged as UNVERIFIED_MISSING_EVIDENCE_PROXY');
  assert(case1Res.isRenewable === false, 'Case 1: Not credited as renewable');

  // Case 2: Unrelated evidence attached (e.g. food invoice, generic note)
  const case2Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: false, // Server detected non-qualifying evidence
    isVerifiedScope2Claim: false
  });
  assert(case2Res.co2Tonnes === 71.6, 'Case 2 (Unrelated Evidence): Falls back to location grid proxy (71.6 tCO2)');
  assert(case2Res.scope2DualReporting.marketClaimStatus === 'UNVERIFIED_MISSING_EVIDENCE_PROXY', 'Case 2: Flagged as UNVERIFIED_MISSING_EVIDENCE_PROXY');

  // Case 3: Qualifying evidence attached, awaiting reviewer audit
  const case3Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: true,
    isVerifiedScope2Claim: false
  });
  assert(case3Res.co2Tonnes === 71.6, 'Case 3 (Pending Review): Falls back to location grid proxy (71.6 tCO2)');
  assert(case3Res.scope2DualReporting.marketClaimStatus === 'UNVERIFIED_PENDING_APPROVAL_PROXY', 'Case 3: Flagged as UNVERIFIED_PENDING_APPROVAL_PROXY');
  assert(case3Res.isRenewable === false, 'Case 3: Pending claim not credited as renewable');

  // Case 4: Rejected claim (auditor explicitly rejected the instrument)
  const case4Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: true,
    isVerifiedScope2Claim: false,
    isRejected: true
  });
  assert(case4Res.co2Tonnes === 71.6, 'Case 4 (Rejected Claim): Falls back to location grid proxy (71.6 tCO2)');
  assert(case4Res.scope2DualReporting.marketClaimStatus === 'CLAIM_REJECTED_PROXY', 'Case 4: Flagged as CLAIM_REJECTED_PROXY');
  assert(case4Res.isRenewable === false, 'Case 4: Rejected claim not credited as renewable');

  // Case 5: Full approved zero claim (100 MWh fully covered by qualifying instrument & audit)
  const case5Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: true,
    isVerifiedScope2Claim: true,
    isPeriodValid: true,
    coveredQuantityMWh: 100
  });
  assert(case5Res.co2Tonnes === 0.0, 'Case 5 (Full Approved Claim): Achieves exact 0.00 tCO2');
  assert(case5Res.scope2DualReporting.marketBased_tCO2 === 0.0, 'Case 5: marketBased_tCO2 is 0.00 tCO2');
  assert(case5Res.scope2DualReporting.locationBased_tCO2 === 71.6, 'Case 5: Dual reporting preserves location baseline (71.6 tCO2)');
  assert(case5Res.scope2DualReporting.marketClaimStatus === 'VERIFIED_ZERO', 'Case 5: Flagged as VERIFIED_ZERO');
  assert(case5Res.isRenewable === true, 'Case 5: Officially credited as renewable');

  // Case 6: Partial coverage (60 MWh covered of 100 MWh total)
  // Covered portion (60 MWh) = 0.00 tCO2; Uncovered portion (40 MWh) = 40 * 0.716 = 28.64 tCO2
  const case6Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: true,
    isVerifiedScope2Claim: true,
    isPeriodValid: true,
    coveredQuantityMWh: 60
  });
  assert(case6Res.co2Tonnes === 28.64, 'Case 6 (Partial Coverage): Reports exact 28.64 tCO2 (40 MWh × 0.716)');
  assert(case6Res.scope2DualReporting.marketBased_tCO2 === 28.64, 'Case 6: marketBased_tCO2 reflects uncovered residual (28.64 tCO2)');
  assert(case6Res.scope2DualReporting.locationBased_tCO2 === 71.6, 'Case 6: Location baseline remains total volume (71.6 tCO2)');
  assert(case6Res.scope2DualReporting.marketClaimStatus === 'PARTIAL_COVERAGE_VERIFIED', 'Case 6: Flagged as PARTIAL_COVERAGE_VERIFIED');
  assert(case6Res.isRenewable === true, 'Case 6: Credited with renewable status for covered portion');

  // Case 7: Instrument outside reporting period (date mismatch)
  const case7Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: true,
    isVerifiedScope2Claim: true,
    isPeriodValid: false // Instrument expired or outside reporting financial year
  });
  assert(case7Res.co2Tonnes === 71.6, 'Case 7 (Period Mismatch): Falls back to location grid proxy (71.6 tCO2)');
  assert(case7Res.scope2DualReporting.marketClaimStatus === 'INSTRUMENT_PERIOD_MISMATCH_PROXY', 'Case 7: Flagged as INSTRUMENT_PERIOD_MISMATCH_PROXY');
  assert(case7Res.isRenewable === false, 'Case 7: Expired/mismatched instrument not credited as renewable');

  // Case 8: Missing or invalid reviewer decision (verifiedScope2Claim undefined/omitted)
  const case8Res = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    hasQualifyingEvidence: true
    // isVerifiedScope2Claim omitted
  });
  assert(case8Res.co2Tonnes === 71.6, 'Case 8 (Missing Reviewer Decision): Falls back to location grid proxy (71.6 tCO2)');
  assert(case8Res.scope2DualReporting.marketClaimStatus === 'UNVERIFIED_PENDING_APPROVAL_PROXY', 'Case 8: Flagged as UNVERIFIED_PENDING_APPROVAL_PROXY');

  // Security Spoof Resistance: Preview mode ignores client-supplied flags
  const previewSpoof = calculateScope2(100000, 'kWh', captiveSolarFactor, {
    isPreview: true,
    hasQualifyingEvidence: true, // Spoofed flag
    isVerifiedScope2Claim: true   // Spoofed flag
  });
  assert(previewSpoof.co2Tonnes === 71.6, 'Spoof Resistance: Preview mode ignores spoofed flags and returns location grid proxy (71.6 tCO2)');
  assert(previewSpoof.scope2DualReporting.marketClaimStatus === 'PREVIEW_UNVERIFIED_PROXY', 'Spoof Resistance: Flagged as PREVIEW_UNVERIFIED_PROXY');
  assert(previewSpoof.isRenewable === false, 'Spoof Resistance: Preview zero claim is NOT credited as renewable energy');

  // Regulatory Constraint: Attempting zero claim under Location-Based accounting throws error
  const fakeLocZeroFactor = { ...captiveSolarFactor, accountingMethod: 'Location-Based' };
  assertThrows(
    () => calculateScope2(100000, 'kWh', fakeLocZeroFactor, { hasQualifyingEvidence: true, isVerifiedScope2Claim: true }),
    'Zero Scope 2 emissions cannot be assigned under Location-Based grid accounting',
    'Regulatory Integrity: Rejects zero emission claim under Location-Based grid accounting'
  );

  // --- SECTION 6: Migration Collision-Safe Distinction Test ---
  console.log('\n--- 6. Testing Migration Collision Prevention & Factor Distinction ---');
  const dryRunRes = await runSafeMigration({ dryRun: true });
  assert(dryRunRes.distinctDiesel === true, 'Dry-run migration proves stationary and mobile diesel factors remain distinct');
  assert(dryRunRes.ambiguousDetected === false, 'No ambiguous matches detected in factor catalog');

  console.log('\n================================================================');
  console.log(` METHODOLOGY AUDIT TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMethodologyTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
