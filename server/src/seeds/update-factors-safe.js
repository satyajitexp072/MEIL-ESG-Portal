const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../../.env' });
const EmissionFactor = require('../models/EmissionFactor');

const safeFactors = [
  {
    factorCode: 'GRID_ELECTRICITY_IN_CEA_V19',
    name: 'Indian National Grid Baseline (CEA v19)',
    fuelIdentifier: 'GRID_ELECTRICITY_IN',
    scope: 2,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (CO2 only)',
    accountingMethod: 'Location-Based',
    contractualInstrumentRequired: false,
    category: 'Purchased Electricity',
    subCategory: 'National Grid Average (Location-Based)',
    fuelOrGridType: 'Grid Electricity',
    factorValue: 0.716,
    factorUnit: 'tCO2/MWh',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 1.0,
    netCalorificValue: { value: 1.0, unit: 'MWh/MWh' },
    density: null,
    sourceCitation: 'Central Electricity Authority (CEA) CO2 Baseline Database for the Indian Power Sector, User Guide Version 19.0 (Dec 2023)',
    publicationYear: 2024,
    reportingPeriod: 'FY 2022-23 Generation Baseline',
    referenceUrl: 'https://cea.nic.in/cdm-co2-baseline-database/',
    notes: 'Weighted average emission factor (incl. RES) for Indian National Grid specifically reflecting the FY 2022-23 generation mix (published Dec 2023). Factor applicability is reporting-period specific; BRSR requires aligning grid factors with the disclosed financial year rather than universally applying v19 across all periods. Covers CO2 only; does not model non-CO2 GHGs.'
  },
  {
    factorCode: 'DIESEL_HSD_STATIONARY_DG',
    name: 'High Speed Diesel (Stationary DG Sets)',
    fuelIdentifier: 'DIESEL_HSD',
    scope: 1,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (CO2 only)',
    accountingMethod: 'Not-Applicable',
    contractualInstrumentRequired: false,
    category: 'Liquid Fuel',
    subCategory: 'Diesel Generator (Stationary Combustion)',
    fuelOrGridType: 'Diesel',
    factorValue: 2.686,
    factorUnit: 'kg CO2/liter',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 0.001,
    netCalorificValue: { value: 36.249, unit: 'MJ/L' },
    density: { value: 0.843, unit: 'kg/L' },
    sourceCitation: 'IPCC 2006 Guidelines for National GHG Inventories, Vol 2 Energy, Ch 1 Table 1.2 (NCV 43 MJ/kg) & Ch 2 Table 2.2 (74,100 kg CO2/TJ)',
    publicationYear: 2006,
    reportingPeriod: 'Continuous (IPCC 2006 Standard)',
    referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
    isOfficial: true,
    notes: 'Net calorific value 43.0 MJ/kg, standard HSD density 0.843 kg/L (BIS IS 1460). Pure CO2 factor: 2.686 kg CO2/L.'
  },
  {
    factorCode: 'DIESEL_HSD_MOBILE_FLEET',
    name: 'High Speed Diesel (Heavy Mobile Equipment & Fleet)',
    fuelIdentifier: 'DIESEL_HSD',
    scope: 1,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (CO2 only)',
    accountingMethod: 'Not-Applicable',
    contractualInstrumentRequired: false,
    category: 'Liquid Fuel',
    subCategory: 'Dumpers, Excavators, Heavy Fleet (Mobile)',
    fuelOrGridType: 'Diesel',
    factorValue: 2.686,
    factorUnit: 'kg CO2/liter',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 0.001,
    netCalorificValue: { value: 36.249, unit: 'MJ/L' },
    density: { value: 0.843, unit: 'kg/L' },
    sourceCitation: 'IPCC 2006 Guidelines, Vol 2 Energy, Ch 3 Table 3.2.1; BIS IS 1460',
    publicationYear: 2006,
    reportingPeriod: 'Continuous (IPCC 2006 Standard)',
    referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
    isOfficial: true,
    notes: 'Mobile off-road equipment diesel combustion factor for infrastructure sites.'
  },
  {
    factorCode: 'MOTOR_GASOLINE_LIGHT_FLEET',
    name: 'Motor Gasoline / Petrol (Company Light Vehicles)',
    fuelIdentifier: 'MOTOR_GASOLINE',
    scope: 1,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (CO2 only)',
    accountingMethod: 'Not-Applicable',
    contractualInstrumentRequired: false,
    category: 'Liquid Fuel',
    subCategory: 'Light Duty Passenger Fleet',
    fuelOrGridType: 'Petrol',
    factorValue: 2.310,
    factorUnit: 'kg CO2/liter',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 0.001,
    netCalorificValue: { value: 33.333, unit: 'MJ/L' },
    density: { value: 0.7524, unit: 'kg/L' },
    sourceCitation: 'IPCC 2006 Guidelines, Vol 2 Energy, Ch 1 Table 1.2 & Ch 3 Table 3.2.1 (69,300 kg CO2/TJ); Commercial Fleet Density 0.7524 kg/L (BIS IS 2796 range 0.720-0.775 kg/L)',
    publicationYear: 2006,
    reportingPeriod: 'Continuous (IPCC 2006 Standard)',
    referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
    isOfficial: true,
    notes: 'Commercial motor gasoline combustion factor (NCV 44.3 MJ/kg, commercial fleet density 0.7524 kg/L, 33.333 MJ/L, 69,300 kg CO2/TJ = 2.310 kg CO2/L; Energy = 0.009259 MWh/L). Note: BIS IS 2796 minimum test benchmark of 0.742 kg/L yields 2.278 kg CO2/L and 0.009131 MWh/L.'
  },
  {
    factorCode: 'NATURAL_GAS_PIPELINE_STATIONARY',
    name: 'Natural Gas / PNG / CNG (Pipelines & Heating)',
    fuelIdentifier: 'NATURAL_GAS_PIPELINE',
    scope: 1,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (CO2 only)',
    accountingMethod: 'Not-Applicable',
    contractualInstrumentRequired: false,
    category: 'Gaseous Fuel',
    subCategory: 'Pipeline Gas & Boilers',
    fuelOrGridType: 'Natural Gas',
    factorValue: 1.979,
    factorUnit: 'kg CO2/SCM',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 0.001,
    netCalorificValue: { value: 35.28, unit: 'MJ/SCM' },
    density: null,
    sourceCitation: 'IPCC 2006 Guidelines, Vol 2 Energy, Ch 2 Table 2.2 (56,100 kg CO2/TJ); PNGRB / GAIL Indian Gas Specs (NCV 35.28 MJ/SCM)',
    publicationYear: 2006,
    reportingPeriod: 'Continuous (IPCC 2006 Standard)',
    referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
    isOfficial: true,
    notes: 'Natural gas pipeline factor based on 56,100 kg CO2/TJ and PNGRB standard NCV of 35.28 MJ/SCM (90% of 39.2 MJ/SCM GCV).'
  },
  {
    factorCode: 'COAL_INDUSTRIAL_G7_BOILER',
    name: 'Indian Indigenous Sub-Bituminous Coal (Grade G7-G8)',
    fuelIdentifier: 'COAL_INDUSTRIAL_G7',
    scope: 1,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (CO2 only)',
    accountingMethod: 'Not-Applicable',
    contractualInstrumentRequired: false,
    category: 'Solid Fuel',
    subCategory: 'Industrial Boilers and Kilns',
    fuelOrGridType: 'Coal',
    factorValue: 1.850,
    factorUnit: 'tCO2/Metric Tonne',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 1.0,
    netCalorificValue: { value: 19.25, unit: 'GJ/MT' },
    density: null,
    sourceCitation: 'IPCC 2006 Guidelines, Vol 2 Energy, Ch 2 Table 2.2 (96,100 kg CO2/TJ); Ministry of Coal Grade G7-G8 NCV 19.25 GJ/MT',
    publicationYear: 2006,
    reportingPeriod: 'Continuous (IPCC 2006 Standard)',
    referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
    isOfficial: true,
    notes: 'Indian domestic boiler coal (Grade G7-G8, NCV 19.25 GJ/MT, 96,100 kg CO2/TJ = 1.850 tCO2/MT).'
  },
  {
    factorCode: 'COAL_POWER_G11_UTILITY',
    name: 'Indian Power Grade Coal (Grade G11-G13)',
    fuelIdentifier: 'COAL_POWER_G11',
    scope: 1,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (CO2 only)',
    accountingMethod: 'Not-Applicable',
    contractualInstrumentRequired: false,
    category: 'Solid Fuel',
    subCategory: 'Thermal Power Plant Coal',
    fuelOrGridType: 'Coal',
    factorValue: 1.605,
    factorUnit: 'tCO2/Metric Tonne',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 1.0,
    netCalorificValue: { value: 16.70, unit: 'GJ/MT' },
    density: null,
    sourceCitation: 'IPCC 2006 Guidelines, Vol 2 Energy, Ch 2 Table 2.2; CEA Baseline Database typical thermal coal NCV 16.70 GJ/MT',
    publicationYear: 2006,
    reportingPeriod: 'Continuous (IPCC 2006 Standard)',
    referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
    isOfficial: true,
    notes: 'Indian domestic thermal coal (Grade G11-G13, NCV 16.70 GJ/MT, 96,100 kg CO2/TJ = 1.605 tCO2/MT).'
  },
  {
    factorCode: 'SOLAR_CAPTIVE_ONSITE_MARKET',
    name: 'Captive Onsite Solar Generation (Market-Based)',
    fuelIdentifier: 'SOLAR_CAPTIVE_ONSITE',
    scope: 2,
    gasCoverage: 'CO2_ONLY',
    gwpBasis: 'N/A (Zero emissions)',
    accountingMethod: 'Market-Based',
    contractualInstrumentRequired: true,
    category: 'Purchased Electricity',
    subCategory: 'On-site Behind-the-Meter Captive Solar',
    fuelOrGridType: 'Solar Power',
    factorValue: 0.0,
    factorUnit: 'tCO2/MWh',
    targetOutputUnit: 'tCO2',
    unitConversionMultiplier: 1.0,
    netCalorificValue: { value: 1.0, unit: 'MWh/MWh' },
    density: null,
    sourceCitation: 'GHG Protocol Scope 2 Guidance (Market-based Method for Certified Renewable Energy)',
    publicationYear: 2015,
    reportingPeriod: 'Continuous Contractual Period',
    referenceUrl: 'https://ghgprotocol.org/scope_2_guidance',
    isOfficial: true,
    notes: 'Documented on-site behind-the-meter captive solar photovoltaic generation. SCADA inverter export telemetry and reviewer verification required.'
  }
];

async function findTargetDocument(factor) {
  let match = await EmissionFactor.findOne({ factorCode: factor.factorCode });
  if (match) {
    return { doc: match, method: 'FACTOR_CODE', isAmbiguous: false };
  }

  if (factor.factorCode === 'DIESEL_HSD_STATIONARY_DG') {
    const exact7a4 = await EmissionFactor.findById('6ac890eaa8969fbc9ab787a4');
    if (exact7a4) {
      return { doc: exact7a4, method: 'STATIONARY_PRIMARY_ID', isAmbiguous: false };
    }
  }

  if (factor.factorCode === 'DIESEL_HSD_MOBILE_FLEET') {
    const exact7a5 = await EmissionFactor.findById('6ac890eaa8969fbc9ab787a5');
    if (exact7a5) {
      return { doc: exact7a5, method: 'MOBILE_PRIMARY_ID', isAmbiguous: false };
    }
  }

  const nameMatches = await EmissionFactor.find({ name: factor.name });
  if (nameMatches.length === 1) {
    return { doc: nameMatches[0], method: 'EXACT_NAME', isAmbiguous: false };
  } else if (nameMatches.length > 1) {
    return { doc: null, method: 'AMBIGUOUS_NAME', isAmbiguous: true, matches: nameMatches };
  }

  const compositeMatches = await EmissionFactor.find({
    fuelIdentifier: factor.fuelIdentifier,
    subCategory: factor.subCategory
  });
  if (compositeMatches.length === 1) {
    return { doc: compositeMatches[0], method: 'COMPOSITE_KEY', isAmbiguous: false };
  } else if (compositeMatches.length > 1) {
    return { doc: null, method: 'AMBIGUOUS_COMPOSITE', isAmbiguous: true, matches: compositeMatches };
  }

  return { doc: null, method: 'NEW_INSERT', isAmbiguous: false };
}

async function runSafeMigration(options = {}) {
  const isDryRun = options.dryRun !== undefined ? options.dryRun : process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meil_esg_db';
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  
  console.log('\n================================================================');
  console.log(` RUNNING SAFE FACTOR MIGRATION ${isDryRun ? '(DRY-RUN MODE - NO WRITES)' : '(APPLYING CHANGES)'}`);
  console.log('================================================================\n');

  const results = [];
  const assignedIds = new Set();
  let ambiguousDetected = false;

  for (const factor of safeFactors) {
    const target = await findTargetDocument(factor);

    if (target.isAmbiguous) {
      console.error(`[AMBIGUOUS MATCH DETECTED] Factor "${factor.factorCode}" (${factor.name}) has ${target.matches.length} candidates. Skipping automated overwrite!`);
      ambiguousDetected = true;
      results.push({
        factorCode: factor.factorCode,
        status: 'SKIPPED_AMBIGUOUS',
        candidatesCount: target.matches.length
      });
      continue;
    }

    if (target.doc) {
      const docId = target.doc._id.toString();
      if (assignedIds.has(docId)) {
        console.error(`[COLLISION DETECTED] Document ID ${docId} was already claimed by another factor! Halting.`);
        throw new Error(`Collision error: Document ${docId} assigned to multiple factors!`);
      }
      assignedIds.add(docId);

      console.log(`[Safe Match] Factor "${factor.factorCode}" -> Document ${docId} (${target.doc.name}) via ${target.method}`);

      if (!isDryRun) {
        await EmissionFactor.findByIdAndUpdate(docId, { $set: factor }, { new: true });
        console.log(`   -> Successfully updated document ${docId} with factorCode: ${factor.factorCode}`);
      } else {
        console.log(`   -> [DRY-RUN] Would update document ${docId} with factorCode: ${factor.factorCode}`);
      }

      results.push({
        factorCode: factor.factorCode,
        status: isDryRun ? 'DRY_RUN_WOULD_UPDATE' : 'UPDATED',
        docId,
        method: target.method
      });
    } else {
      console.log(`[New Factor] Factor "${factor.factorCode}" (${factor.name}) -> No existing document found; will insert as new record.`);
      if (!isDryRun) {
        const created = await EmissionFactor.create(factor);
        console.log(`   -> Successfully inserted new document ${created._id}`);
        results.push({
          factorCode: factor.factorCode,
          status: 'INSERTED',
          docId: created._id.toString(),
          method: 'NEW_INSERT'
        });
      } else {
        console.log(`   -> [DRY-RUN] Would insert new document.`);
        results.push({
          factorCode: factor.factorCode,
          status: 'DRY_RUN_WOULD_INSERT',
          docId: 'NEW',
          method: 'NEW_INSERT'
        });
      }
    }
  }

  const stationaryRes = results.find(r => r.factorCode === 'DIESEL_HSD_STATIONARY_DG');
  const mobileRes = results.find(r => r.factorCode === 'DIESEL_HSD_MOBILE_FLEET');
  
  const distinctDiesel = Boolean(
    stationaryRes && mobileRes && stationaryRes.docId !== mobileRes.docId
  );

  console.log(`\n--- Verification of Factor Uniqueness ---`);
  console.log(`Stationary Diesel Target ID: ${stationaryRes ? stationaryRes.docId : 'None'}`);
  console.log(`Mobile Diesel Target ID:     ${mobileRes ? mobileRes.docId : 'None'}`);
  console.log(`Distinct Diesel Factors:     ${distinctDiesel ? 'YES (NO COLLISION)' : 'NO (COLLISION DETECTED)'}`);

  if (!distinctDiesel) {
    throw new Error('Fatal: Stationary and Mobile diesel factors collided or share the same target ID!');
  }

  console.log(`\n================================================================`);
  console.log(` SAFE MIGRATION ${isDryRun ? 'DRY-RUN' : 'EXECUTION'} FINISHED: ${results.length} FACTORS PROCESSED, 0 OVERWRITE CONFLICTS`);
  console.log('================================================================\n');

  return { results, distinctDiesel, ambiguousDetected };
}

if (require.main === module) {
  runSafeMigration()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Migration Error]:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { runSafeMigration, safeFactors };
