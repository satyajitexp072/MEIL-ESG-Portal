const { calculateScope1 } = require('../src/services/calculations/scope1');
const { calculateScope2 } = require('../src/services/calculations/scope2');
const { calculateEmissions } = require('../src/services/calculations/index');

function runTests() {
  console.log('\n================================================================');
  console.log(' RUNNING STAGE B: CALCULATION CORRECTNESS & REGULATORY INTEGRITY');
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

  // Factor fixtures representing verified primary sources
  const dieselFactor = {
    scope: 1,
    fuelIdentifier: 'DIESEL_HSD',
    fuelOrGridType: 'Diesel',
    category: 'Liquid Fuel',
    subCategory: 'Diesel Generator (Stationary)',
    factorValue: 2.686,
    factorUnit: 'kg CO2/liter',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 0.001,
    sourceCitation: 'IPCC 2006 Vol 2 Energy',
    publicationYear: 2006
  };

  const petrolFactor = {
    scope: 1,
    fuelIdentifier: 'MOTOR_GASOLINE',
    fuelOrGridType: 'Petrol',
    category: 'Liquid Fuel',
    subCategory: 'Fleet Vehicles (Mobile)',
    factorValue: 2.31,
    factorUnit: 'kg CO2/liter',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 0.001,
    sourceCitation: 'IPCC 2006 Vol 2 Energy',
    publicationYear: 2006
  };

  const gasFactor = {
    scope: 1,
    fuelIdentifier: 'NATURAL_GAS_PIPELINE',
    fuelOrGridType: 'Natural Gas',
    category: 'Gaseous Fuel',
    subCategory: 'Pipeline Gas',
    factorValue: 1.979,
    factorUnit: 'kg CO2/SCM',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 0.001,
    sourceCitation: 'IPCC 2006 Vol 2 Energy',
    publicationYear: 2006
  };

  const coalFactor = {
    scope: 1,
    fuelIdentifier: 'COAL_INDUSTRIAL_G7',
    fuelOrGridType: 'Coal',
    category: 'Solid Fuel',
    subCategory: 'Indigenous Coal G7',
    factorValue: 1.85,
    factorUnit: 'tCO2/Metric Tonne',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 1.0,
    sourceCitation: 'IPCC 2006 Vol 2 Energy',
    publicationYear: 2006
  };

  const ceaGridFactor = {
    scope: 2,
    fuelIdentifier: 'GRID_ELECTRICITY_IN',
    fuelOrGridType: 'Grid Electricity',
    category: 'Electricity',
    subCategory: 'Indian National Grid Baseline v19',
    factorValue: 0.716,
    factorUnit: 'tCO2/MWh',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 1.0,
    accountingMethod: 'Location-Based',
    contractualInstrumentRequired: false,
    sourceCitation: 'Central Electricity Authority (CEA) v19',
    publicationYear: 2024
  };

  const captiveSolarMarketFactor = {
    scope: 2,
    fuelIdentifier: 'SOLAR_CAPTIVE_ONSITE',
    fuelOrGridType: 'Solar Power',
    category: 'Renewable Electricity',
    subCategory: 'On-site Captive Behind-the-Meter Solar',
    factorValue: 0.0,
    factorUnit: 'tCO2/MWh',
    gasCoverage: 'CO2_ONLY',
    unitConversionMultiplier: 1.0,
    accountingMethod: 'Market-Based',
    contractualInstrumentRequired: true,
    notes: 'Documented on-site behind-the-meter captive solar generation.',
    sourceCitation: 'GHG Protocol Scope 2 Market-Based Guidance',
    publicationYear: 2015
  };

  // 1. Scope 1 Known Inputs
  console.log('--- 1. Testing Scope 1 Known Inputs ---');
  const dRes = calculateScope1(10000, 'Liters', dieselFactor);
  assert(dRes.co2Tonnes === 26.86, 'Diesel 10,000 Liters yields 26.86 tCO2', `got ${dRes.co2Tonnes}`);
  assert(dRes.energyMWh === 100.69, 'Diesel 10,000 Liters yields 100.69 MWh primary energy', `got ${dRes.energyMWh}`);

  const pRes = calculateScope1(5000, 'Liters', petrolFactor);
  assert(pRes.co2Tonnes === 11.55, 'Petrol 5,000 Liters yields 11.55 tCO2', `got ${pRes.co2Tonnes}`);
  assert(Math.abs(pRes.energyMWh - 46.295) < 0.01, 'Petrol 5,000 Liters yields 46.295 MWh primary energy (reconciled density 0.752 kg/L)', `got ${pRes.energyMWh}`);

  // Test BIS IS 2796 minimum density petrol variant (2.278 kg CO2/L, density 0.742 kg/L)
  const petrolBisFactor = { ...petrolFactor, factorValue: 2.278, density: { value: 0.742, unit: 'kg/L' } };
  const pBisRes = calculateScope1(5000, 'Liters', petrolBisFactor);
  assert(pBisRes.co2Tonnes === 11.39, 'Petrol BIS IS 2796 5,000 Liters yields 11.39 tCO2', `got ${pBisRes.co2Tonnes}`);
  assert(pBisRes.energyMWh === 45.655, 'Petrol BIS IS 2796 5,000 Liters yields 45.655 MWh primary energy (density 0.742 kg/L)', `got ${pBisRes.energyMWh}`);

  const gRes = calculateScope1(20000, 'SCM', gasFactor);
  assert(gRes.co2Tonnes === 39.58, 'Natural Gas 20,000 SCM yields 39.58 tCO2', `got ${gRes.co2Tonnes}`);
  assert(gRes.energyMWh === 196.0, 'Natural Gas 20,000 SCM yields 196.0 MWh primary energy', `got ${gRes.energyMWh}`);

  const cRes = calculateScope1(50, 'Metric Tonnes', coalFactor);
  assert(cRes.co2Tonnes === 92.5, 'Coal 50 MT yields 92.5 tCO2', `got ${cRes.co2Tonnes}`);
  assert(cRes.energyMWh === 267.36, 'Coal 50 MT yields 267.36 MWh primary energy', `got ${cRes.energyMWh}`);

  // 2. Scope 1 Unit Conversions
  console.log('\n--- 2. Testing Scope 1 Unit Conversions ---');
  const dKlRes = calculateScope1(10, 'kL', dieselFactor);
  assert(dKlRes.co2Tonnes === 26.86, 'Diesel 10 kL correctly normalized to 10,000 Liters (26.86 tCO2)');

  const dMtRes = calculateScope1(1, 'Metric Tonnes', dieselFactor);
  // 1 MT diesel = 1000 / 0.843 = 1186.2396 L * 2.686 * 0.001 = 3.1862 tCO2
  assert(Math.abs(dMtRes.co2Tonnes - 3.1862) < 0.01, 'Diesel 1 Metric Tonne normalized via density to 1,186.24 Liters (3.1862 tCO2)');

  const cKgRes = calculateScope1(50000, 'kg', coalFactor);
  assert(cKgRes.co2Tonnes === 92.5, 'Coal 50,000 kg normalized to 50 Metric Tonnes (92.5 tCO2)');

  const gNm3Res = calculateScope1(10000, 'Nm3', gasFactor);
  // 10,000 Nm3 * 1.055 = 10,550 SCM * 1.979 * 0.001 = 20.878 tCO2
  assert(Math.abs(gNm3Res.co2Tonnes - 20.8784) < 0.01, 'Natural Gas 10,000 Nm3 normalized to 10,550 SCM (20.8784 tCO2)');

  // 3. Scope 1 Invalid Inputs & Fallback Removal
  console.log('\n--- 3. Testing Scope 1 Rejection of Invalid Inputs & Generic Fallbacks ---');
  assertThrows(() => calculateScope1(-100, 'Liters', dieselFactor), 'cannot be negative', 'Rejects negative activity value');
  assertThrows(() => calculateScope1('invalid', 'Liters', dieselFactor), 'must be a valid numeric value', 'Rejects non-numeric activity value');
  assertThrows(() => calculateScope1(100, '', dieselFactor), 'unit is required', 'Rejects empty activity unit');
  assertThrows(() => calculateScope1(100, 'kWh', dieselFactor), 'Incompatible unit "kWh"', 'Rejects incompatible unit (kWh for Diesel)');
  assertThrows(() => calculateScope1(100, 'gallons', dieselFactor), 'Incompatible unit "gallons"', 'Rejects unsupported unit (gallons for Diesel)');
  
  const unknownFuelFactor = {
    scope: 1,
    fuelOrGridType: 'Synthetic_Unknown_Fuel',
    subCategory: 'Mystery Fuel',
    factorValue: 1.5,
    factorUnit: 'kg/L'
  };
  assertThrows(() => calculateScope1(100, 'Liters', unknownFuelFactor), 'Invalid or unmapped fuelIdentifier', 'Rejects unknown fuel identifier and disallows generic fallback');

  // 4. Scope 2 Known Inputs & Unit Conversions
  console.log('\n--- 4. Testing Scope 2 Location-Based Calculations (CEA v19) ---');
  const s2Kwh = calculateScope2(100000, 'kWh', ceaGridFactor);
  assert(s2Kwh.co2Tonnes === 71.6, '100,000 kWh grid yields 71.6 tCO2 (100 MWh × 0.716)');
  assert(s2Kwh.energyMWh === 100, '100,000 kWh normalized to 100 MWh energy');
  assert(s2Kwh.isRenewable === false, 'Location-based grid power is non-renewable');

  const s2Units = calculateScope2(50000, 'Units', ceaGridFactor);
  assert(s2Units.co2Tonnes === 35.8, '50,000 Indian DISCOM Units yields 35.8 tCO2');

  const s2Mwh = calculateScope2(250, 'MWh', ceaGridFactor);
  assert(s2Mwh.co2Tonnes === 179.0, '250 MWh grid yields 179.0 tCO2');

  const s2Gwh = calculateScope2(0.5, 'GWh', ceaGridFactor);
  assert(s2Gwh.co2Tonnes === 358.0, '0.5 GWh correctly normalized to 500 MWh (358.0 tCO2)');

  // 5. Scope 2 Market-Based & Zero-Emission Claims Validation
  console.log('\n--- 5. Testing Scope 2 Market-Based Zero Emission Validation ---');
  const s2Solar = calculateScope2(65000, 'kWh', captiveSolarMarketFactor, { hasQualifyingEvidence: true, isVerifiedScope2Claim: true });
  assert(s2Solar.co2Tonnes === 0.0, 'Valid Market-Based Onsite Captive Solar yields 0.00 tCO2');
  assert(s2Solar.isRenewable === true, 'Valid Captive Solar marked isRenewable = true');
  assert(s2Solar.energyMWh === 65.0, '65 MWh energy credited for BRSR Principle 6 Indicator 1');

  // Attempt to claim 0 emissions under Location-Based accounting
  const fakeLocationZeroFactor = {
    scope: 2,
    fuelOrGridType: 'Solar Power',
    factorValue: 0.0,
    factorUnit: 'tCO2e/MWh',
    accountingMethod: 'Location-Based', // Invalid combination!
    contractualInstrumentRequired: false,
    sourceCitation: 'Fake Green Label'
  };
  assertThrows(
    () => calculateScope2(50000, 'kWh', fakeLocationZeroFactor),
    'Zero Scope 2 emissions cannot be assigned under Location-Based grid accounting',
    'Rejects zero emission claim under Location-Based grid accounting'
  );

  // Attempt to claim 0 emissions without evidence & review (falls back to location baseline proxy)
  const fakeMarketZeroFactor = {
    scope: 2,
    fuelOrGridType: 'Solar Power',
    factorValue: 0.0,
    factorUnit: 'tCO2/MWh',
    accountingMethod: 'Market-Based',
    sourceCitation: 'Unverified Claim'
  };
  const unverifiedRes = calculateScope2(50000, 'kWh', fakeMarketZeroFactor, { hasEvidence: false, isVerified: false });
  assert(unverifiedRes.co2Tonnes === 35.8, 'Unverified claim without evidence falls back to location grid proxy (35.8 tCO2)');
  assert(unverifiedRes.isRenewable === false, 'Unverified claim without evidence is not credited as renewable');

  // Scope 2 Invalid units
  assertThrows(() => calculateScope2(1000, 'liters', ceaGridFactor), 'Unsupported activity unit "liters"', 'Rejects volumetric unit for electricity');
  assertThrows(() => calculateScope2(1000, 'tons', ceaGridFactor), 'Unsupported activity unit "tons"', 'Rejects mass unit for electricity');
  assertThrows(() => calculateScope2(-50, 'kWh', ceaGridFactor), 'cannot be negative', 'Rejects negative electricity value');

  // 6. Dispatcher Integrity
  console.log('\n--- 6. Testing Calculation Dispatcher Integrity ---');
  assertThrows(() => calculateEmissions(100, 'Liters', null), 'Emission factor reference document is required', 'Rejects missing factor document');
  assertThrows(() => calculateEmissions(100, 'Liters', { scope: 3 }), 'Scope 3 calculations are not enabled in this prototype', 'Rejects Scope 3 calculation attempt (Preserves non-claim rule)');
  assertThrows(() => calculateEmissions(100, 'Liters', { scope: 99 }), 'Unsupported GHG scope', 'Rejects invalid scope number');

  console.log('\n================================================================');
  console.log(` TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
