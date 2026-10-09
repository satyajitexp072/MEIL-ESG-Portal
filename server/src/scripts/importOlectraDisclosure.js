const mongoose = require('mongoose');
require('dotenv').config();

const { importOlectraDisclosures } = require('../services/olectraDisclosureImporter');

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meil_esg_db';
    console.log(`[Public Disclosure Import] Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    console.log('[Public Disclosure Import] Starting Olectra Greentech Limited public disclosure import...');
    const result = await importOlectraDisclosures();

    console.log(`[Public Disclosure Import] ${result.message}`);
    result.disclosures.forEach(d => {
      console.log(`\n------------------------------------------------------------`);
      console.log(`Financial Year:             ${d.financialYear}`);
      console.log(`Reporting Entity:           ${d.reportingEntityName} (${d.entityCode})`);
      console.log(`Attributed to MEIL Group:   ${d.attributedToMeilGroup ? 'YES' : 'NO (Standalone Subsidiary)'}`);
      console.log(`Source Document:            ${d.reportTitle}`);
      console.log(`Source URL:                 ${d.sourceUrl}`);
      console.log(`Provenance Status:          ${d.provenanceStatus}`);
      console.log(`Independently Audited:      ${d.isIndependentlyAudited ? 'YES' : 'NO'}`);
      console.log(`Import Timestamp:           ${d.importTimestamp.toISOString()}`);
      console.log(`Scope 1 Emissions:          ${d.ghgEmissions.scope1_tCO2e} tCO2e`);
      console.log(`Scope 2 Emissions:          ${d.ghgEmissions.scope2_tCO2e} tCO2e`);
      console.log(`Scope 1+2 Intensity:        ${d.ghgEmissions.scope1And2_Intensity_per_Turnover.value} ${d.ghgEmissions.scope1And2_Intensity_per_Turnover.unit}`);
      console.log(`Total Energy:               ${d.energyConsumption_GJ.totalEnergy_GJ} GJ`);
      console.log(`Non-Renewable Electricity:  ${d.energyConsumption_GJ.nonRenewableElectricity_GJ} GJ`);
      console.log(`Non-Renewable Fuel:         ${d.energyConsumption_GJ.nonRenewableFuel_GJ} GJ`);
      console.log(`Other Non-Renewable Energy: ${d.energyConsumption_GJ.otherNonRenewableEnergy_GJ} GJ`);
      console.log(`Renewable (Elec/Fuel/Other): 0 GJ / 0 GJ / 0 GJ`);
    });
    console.log(`------------------------------------------------------------\n`);
  } catch (err) {
    console.error('[Public Disclosure Import] Error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[Public Disclosure Import] Disconnected from MongoDB.');
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
