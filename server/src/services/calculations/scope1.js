/**
 * Scope 1 Calculation Engine (Direct GHG Emissions)
 * Follows IPCC 2006 Guidelines for National Greenhouse Gas Inventories (Volume 2: Energy)
 * 
 * Strict Methodology Controls:
 * 1. Controlled Fuel Identifiers (No loose string substring guessing)
 * 2. Fuel & Unit Compatibility Enforced
 * 3. Exact primary source NCVs & densities (Discrepancies in coal & gas resolved)
 * 4. Transparent CO2 vs CO2e Gas Coverage (CO2-only factors must not claim non-CO2 GHGs without methodology backing)
 */

const CONTROLLED_FUELS = {
  DIESEL_HSD: {
    id: 'DIESEL_HSD',
    name: 'High Speed Diesel (HSD)',
    physicalState: 'Liquid Fuel',
    primarySource: 'IPCC 2006 Vol 2 Ch 1 Table 1.2 & Ch 2 Table 2.2 / Ch 3 Table 3.2.1; BIS IS 1460',
    allowedActivityUnits: ['liters', 'liter', 'l', 'kl', 'kiloliters', 'metric tonnes', 'metric tonne', 'mt', 'tonnes'],
    standardUnit: 'Liters',
    densityKgPerLiter: 0.843,
    ncvMJPerLiter: 36.249, // 43.0 MJ/kg * 0.843 kg/L = 36.249 MJ/L (0.000036249 TJ/L)
    energyMWhPerLiter: 0.010069, // 36.249 / 3600 MWh/L
    ipccDefault_kgCO2_per_TJ: 74100,
    normalize: (val, unit) => {
      const u = unit.toLowerCase();
      if (u === 'kl' || u === 'kiloliters') return { normalized: val * 1000, desc: 'Converted kL to Liters (× 1,000)' };
      if (u === 'metric tonnes' || u === 'metric tonne' || u === 'mt' || u === 'tonnes') {
        const liters = val * (1000 / 0.843);
        return { normalized: liters, desc: 'Converted Metric Tonnes to Liters (standard HSD density 0.843 kg/L: × 1,186.24)' };
      }
      return { normalized: val, desc: null };
    }
  },
  MOTOR_GASOLINE: {
    id: 'MOTOR_GASOLINE',
    name: 'Motor Gasoline (Petrol)',
    physicalState: 'Liquid Fuel',
    primarySource: 'IPCC 2006 Vol 2 Ch 1 Table 1.2 & Ch 3 Table 3.2.1; BIS IS 2796',
    allowedActivityUnits: ['liters', 'liter', 'l', 'kl', 'kiloliters'],
    standardUnit: 'Liters',
    // 1. Standard Commercial Fleet Density (0.7524 kg/L) - Aligned with factor 2.310 kg CO2/L:
    //    NCV = 44.3 MJ/kg * 0.75244 kg/L = 33.333 MJ/L (0.000033333 TJ/L)
    //    Factor = 0.000033333 TJ/L * 69,300 kg CO2/TJ = 2.310 kg CO2/L
    //    Energy = 33.333 MJ/L / 3600 = 0.009259 MWh/L
    //    Thermodynamic Ratio: 2.310 kg CO2/L / (0.009259 MWh/L * 1000) = 0.24948 tCO2/MWh (Matches IPCC 69,300 kg/TJ)
    densityKgPerLiter: 0.7524,
    ncvMJPerLiter: 33.333,
    energyMWhPerLiter: 0.009259,
    ipccDefault_kgCO2_per_TJ: 69300,
    // 2. BIS IS 2796 Minimum Density Benchmark (0.742 kg/L) - Aligned with factor 2.278 kg CO2/L:
    //    NCV = 44.3 MJ/kg * 0.742 kg/L = 32.871 MJ/L (0.000032871 TJ/L)
    //    Factor = 0.000032871 TJ/L * 69,300 kg CO2/TJ = 2.278 kg CO2/L (2.2779 kg CO2/L)
    //    Energy = 32.871 MJ/L / 3600 = 0.009131 MWh/L
    //    Thermodynamic Ratio: 2.278 kg CO2/L / (0.009131 MWh/L * 1000) = 0.24948 tCO2/MWh
    bisIS2796Variant: {
      densityKgPerLiter: 0.742,
      ncvMJPerLiter: 32.871,
      factorValue: 2.278,
      energyMWhPerLiter: 0.009131
    },
    normalize: (val, unit) => {
      const u = unit.toLowerCase();
      if (u === 'kl' || u === 'kiloliters') return { normalized: val * 1000, desc: 'Converted kL to Liters (× 1,000)' };
      return { normalized: val, desc: null };
    }
  },
  NATURAL_GAS_PIPELINE: {
    id: 'NATURAL_GAS_PIPELINE',
    name: 'Pipeline Natural Gas (PNG/CNG)',
    physicalState: 'Gaseous Fuel',
    primarySource: 'IPCC 2006 Vol 2 Ch 2 Table 2.2; GAIL / PNGRB Pipeline Gas Specifications',
    allowedActivityUnits: ['scm', 'standard cubic meters', 'nm3', 'normal cubic meters'],
    standardUnit: 'SCM',
    densityKgPerLiter: null,
    // PNGRB GCV = 39.20 MJ/SCM; NCV = 90% of GCV = 35.28 MJ/SCM (0.00003528 TJ/SCM)
    ncvMJPerSCM: 35.28,
    energyMWhPerSCM: 0.009800, // 35.28 / 3600 MWh/SCM
    ipccDefault_kgCO2_per_TJ: 56100,
    normalize: (val, unit) => {
      const u = unit.toLowerCase();
      if (u === 'nm3' || u === 'normal cubic meters') {
        return { normalized: val * 1.055, desc: 'Converted Normal m³ (0°C, 1 atm) to Standard m³ (15°C, 1 atm): × 1.055' };
      }
      return { normalized: val, desc: null };
    }
  },
  COAL_INDUSTRIAL_G7: {
    id: 'COAL_INDUSTRIAL_G7',
    name: 'Indian Non-Coking Coal (Grade G7-G8 Boiler Coal)',
    physicalState: 'Solid Fuel',
    primarySource: 'IPCC 2006 Vol 2 Ch 2 Table 2.2; Ministry of Coal Grade G7-G8 NCV 19.25 GJ/MT',
    allowedActivityUnits: ['metric tonnes', 'metric tonne', 'mt', 'tonnes', 'kg', 'kilograms'],
    standardUnit: 'Metric Tonnes',
    ncvGJPerMT: 19.25, // 0.01925 TJ/MT
    energyMWhPerMT: 5.3472, // 19.25 / 3.6 MWh/MT
    ipccDefault_kgCO2_per_TJ: 96100,
    normalize: (val, unit) => {
      const u = unit.toLowerCase();
      if (u === 'kg' || u === 'kilograms') return { normalized: val / 1000, desc: 'Converted kg to Metric Tonnes (/ 1,000)' };
      return { normalized: val, desc: null };
    }
  },
  COAL_POWER_G11: {
    id: 'COAL_POWER_G11',
    name: 'Indian Non-Coking Coal (Grade G11-G13 Thermal Coal)',
    primarySource: 'IPCC 2006 Vol 2 Ch 2 Table 2.2; CEA Baseline Database typical thermal coal NCV 16.70 GJ/MT',
    physicalState: 'Solid Fuel',
    allowedActivityUnits: ['metric tonnes', 'metric tonne', 'mt', 'tonnes', 'kg', 'kilograms'],
    standardUnit: 'Metric Tonnes',
    ncvGJPerMT: 16.70, // 0.01670 TJ/MT
    energyMWhPerMT: 4.6389, // 16.70 / 3.6 MWh/MT
    ipccDefault_kgCO2_per_TJ: 96100,
    normalize: (val, unit) => {
      const u = unit.toLowerCase();
      if (u === 'kg' || u === 'kilograms') return { normalized: val / 1000, desc: 'Converted kg to Metric Tonnes (/ 1,000)' };
      return { normalized: val, desc: null };
    }
  }
};

function calculateScope1(activityValue, activityUnit, factor) {
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

  // Controlled Fuel Identifier Validation (Strict Enumeration)
  const fuelId = factor.fuelIdentifier;
  if (!fuelId || !CONTROLLED_FUELS[fuelId]) {
    throw new Error(
      `Invalid or unmapped fuelIdentifier "${fuelId}". Calculations require a controlled fuel identifier (e.g. DIESEL_HSD, MOTOR_GASOLINE, NATURAL_GAS_PIPELINE, COAL_INDUSTRIAL_G7).`
    );
  }

  const fuelProfile = CONTROLLED_FUELS[fuelId];
  const unitClean = activityUnit.trim().toLowerCase();

  // Unit Compatibility Check
  if (!fuelProfile.allowedActivityUnits.includes(unitClean)) {
    throw new Error(
      `Incompatible unit "${activityUnit}" for fuel "${fuelProfile.name}" (${fuelProfile.physicalState}). Allowed units are: ${fuelProfile.allowedActivityUnits.join(', ')}.`
    );
  }

  // Factor Category Compatibility Check
  if (factor.category && !factor.category.toLowerCase().includes(fuelProfile.physicalState.toLowerCase().split(' ')[0])) {
    throw new Error(
      `Mismatched fuel category: Factor category "${factor.category}" does not match fuel physical state "${fuelProfile.physicalState}".`
    );
  }

  // Factor Unit Compatibility Check
  if (!factor.factorUnit || typeof factor.factorUnit !== 'string') {
    throw new Error('Emission factor unit is required.');
  }
  const factorUnitLower = factor.factorUnit.trim().toLowerCase();

  // Validate factor unit against fuel physical state
  if (fuelProfile.physicalState === 'Liquid Fuel') {
    if (factorUnitLower.includes('scm') || factorUnitLower.includes('nm3') || factorUnitLower.includes('kwh') || factorUnitLower.includes('mwh')) {
      throw new Error(`Incompatible factor unit "${factor.factorUnit}" for liquid fuel "${fuelProfile.name}". Liquid fuels require volumetric (liter/kL) or mass (MT) factor units.`);
    }
  } else if (fuelProfile.physicalState === 'Gaseous Fuel') {
    if (factorUnitLower.includes('liter') || factorUnitLower.includes('kl') || factorUnitLower.includes('kwh') || factorUnitLower.includes('mwh') || factorUnitLower.includes('/mt') || factorUnitLower.includes('/metric tonne')) {
      throw new Error(`Incompatible factor unit "${factor.factorUnit}" for gaseous fuel "${fuelProfile.name}". Gaseous fuels require standard gas volume (SCM/Nm3) factor units.`);
    }
  } else if (fuelProfile.physicalState === 'Solid Fuel') {
    if (factorUnitLower.includes('liter') || factorUnitLower.includes('kl') || factorUnitLower.includes('scm') || factorUnitLower.includes('nm3') || factorUnitLower.includes('kwh') || factorUnitLower.includes('mwh')) {
      throw new Error(`Incompatible factor unit "${factor.factorUnit}" for solid fuel "${fuelProfile.name}". Solid fuels require mass (Metric Tonne/MT/kg) factor units.`);
    }
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

  // Normalization
  const { normalized, desc: convDesc } = fuelProfile.normalize(numValue, unitClean);
  const factorValue = factor.factorValue;

  // Gas Coverage Methodology Integrity
  const gasCoverage = factor.gasCoverage || 'CO2_ONLY';
  const co2Tonnes = Number((normalized * factorValue * multiplier).toFixed(4));
  
  // CO2 vs CO2e Data Model: If CO2_ONLY, co2eTonnes is explicitly null to avoid claiming unmodeled non-CO2 GHGs
  const co2eTonnes = (gasCoverage === 'CO2E_GHG_SUM') ? co2Tonnes : null;
  const co2eStatus = (gasCoverage === 'CO2E_GHG_SUM') ? 'FULLY_QUANTIFIED' : 'NOT_QUANTIFIED_CO2_ONLY';

  // Energy Calculation (MWh) from documented primary source NCVs
  let energyMWh = 0;
  if (fuelId === 'DIESEL_HSD') {
    energyMWh = Number((normalized * fuelProfile.energyMWhPerLiter).toFixed(4));
  } else if (fuelId === 'MOTOR_GASOLINE') {
    // Reconcile primary energy with factor's physical density assumption:
    // If factor corresponds to BIS IS 2796 minimum test benchmark (2.278 kg CO2/L or explicit 0.742 kg/L density):
    // use 0.009131 MWh/L. Otherwise, for standard commercial fleet petrol (2.310 kg CO2/L): use 0.009259 MWh/L.
    let rate = fuelProfile.energyMWhPerLiter; // 0.009259 MWh/L (commercial default)
    if (Math.abs(factorValue - 2.278) < 0.01 ||
        (factor.density && Math.abs(factor.density.value - 0.742) < 0.005 && Math.abs(factorValue - 2.310) > 0.01)) {
      rate = fuelProfile.bisIS2796Variant.energyMWhPerLiter; // 0.009131 MWh/L (BIS IS 2796 variant)
    }
    energyMWh = Number((normalized * rate).toFixed(4));
  } else if (fuelId === 'NATURAL_GAS_PIPELINE') {
    energyMWh = Number((normalized * fuelProfile.energyMWhPerSCM).toFixed(4));
  } else if (fuelId === 'COAL_INDUSTRIAL_G7' || fuelId === 'COAL_POWER_G11') {
    energyMWh = Number((normalized * fuelProfile.energyMWhPerMT).toFixed(4));
  }

  const steps = [
    `1. Controlled Fuel Identifier: ${fuelProfile.id} — ${fuelProfile.name}`,
    `2. Activity Input: ${numValue.toLocaleString()} ${activityUnit}`
  ];

  if (convDesc) {
    steps.push(`3. Unit Normalization: ${convDesc} => ${normalized.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${fuelProfile.standardUnit}`);
  }

  steps.push(
    `4. Emission Factor: ${factorValue} ${factor.factorUnit} (Source: ${factor.sourceCitation}, ${factor.publicationYear})`,
    `5. Gas Coverage: ${gasCoverage === 'CO2_ONLY' ? 'CO2 strictly (non-CO2 GHGs unquantified in primary table; CO2e unestablished)' : 'CO2e (GHG sum with documented GWPs)'}`,
    `6. Computed Emissions: ${normalized.toFixed(2)} × ${factorValue} × ${multiplier} = ${co2Tonnes} ${gasCoverage === 'CO2_ONLY' ? 'tCO2' : 'tCO2e'}`,
    `7. Primary Energy Consumed: ${energyMWh.toLocaleString()} MWh (for BRSR Principle 6 Indicator 1 Energy disclosure)`
  );

  const formulaApplied = `Emissions = ${normalized.toLocaleString(undefined, { maximumFractionDigits: 2 })} [${fuelProfile.standardUnit}] × ${factorValue} ${factor.factorUnit} × ${multiplier} = ${co2Tonnes} ${gasCoverage === 'CO2_ONLY' ? 'tCO2' : 'tCO2e'}`;

  return {
    co2Tonnes,
    co2eTonnes,
    co2eStatus,
    gasCoverage,
    energyMWh,
    isRenewable: false,
    formulaApplied,
    calculationSteps: steps
  };
}

module.exports = { calculateScope1, CONTROLLED_FUELS };
