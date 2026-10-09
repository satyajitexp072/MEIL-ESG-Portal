const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Entity = require('../src/models/Entity');
const EmissionFactor = require('../src/models/EmissionFactor');
const MetricEntry = require('../src/models/MetricEntry');
const PublishedDisclosure = require('../src/models/PublishedDisclosure');
const User = require('../src/models/User');
const { importOlectraDisclosures, SOURCE_URL } = require('../src/services/olectraDisclosureImporter');
const reportController = require('../src/controllers/report.controller');

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_characters_long_for_security';

async function runDisclosureTests() {
  console.log('\n================================================================');
  console.log(' RUNNING PUBLIC ESG DISCLOSURE IMPORT & ISOLATION TESTS');
  console.log('================================================================');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meil_esg_db';
  await mongoose.connect(mongoUri);

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  try {
    // Ensure disclosures are imported
    await importOlectraDisclosures();

    const disclosures = await PublishedDisclosure.find({}).sort({ financialYear: -1 });
    const d25 = disclosures.find(d => d.financialYear === 'FY 2024-25');
    const d24 = disclosures.find(d => d.financialYear === 'FY 2023-24');
    const olectraEntity = await Entity.findOne({ code: 'MEIL-OLECTRA' });
    const meilHolding = await Entity.findOne({ code: 'MEIL-CORP' });

    console.log('\n--- 1. Testing Provenance & Source Citation ---');

    test('Source URL matches official Olectra PDF', () => {
      assert.strictEqual(d25.sourceUrl, 'https://olectra.com/wp-content/uploads/AR-2024-25.pdf');
      assert.strictEqual(d24.sourceUrl, SOURCE_URL);
    });

    test('Report title reflects official Annual Report / BRSR', () => {
      assert(d25.reportTitle.includes('Annual Report 2024-25'));
      assert(d25.reportTitle.includes('BRSR'));
    });

    test('Source page and table reference BRSR Principle 6', () => {
      assert(d25.sourcePageTable.includes('Principle 6'));
      assert(d25.sourcePageTable.includes('Essential Indicators'));
    });

    test('Provenance status is COMPANY_REPORTED_PUBLISHED_DISCLOSURE', () => {
      assert.strictEqual(d25.provenanceStatus, 'COMPANY_REPORTED_PUBLISHED_DISCLOSURE');
      assert.strictEqual(d24.provenanceStatus, 'COMPANY_REPORTED_PUBLISHED_DISCLOSURE');
    });

    test('Record is strictly NOT marked as independently audited', () => {
      assert.strictEqual(d25.isIndependentlyAudited, false);
      assert.strictEqual(d24.isIndependentlyAudited, false);
      assert(d25.auditAssuranceNotes.includes('Not independently audited'));
    });

    test('Import timestamp is valid and recorded', () => {
      assert(d25.importTimestamp instanceof Date);
      assert(!isNaN(d25.importTimestamp.getTime()));
    });

    console.log('\n--- 2. Testing Entity Attribution & Boundary Isolation ---');

    test('Reporting entity is identified as Olectra Greentech Limited', () => {
      assert.strictEqual(d25.reportingEntityName, 'Olectra Greentech Limited');
      assert.strictEqual(d25.entityCode, 'MEIL-OLECTRA');
      assert.strictEqual(d25.reportingEntity.toString(), olectraEntity._id.toString());
    });

    test('Disclosure is strictly NOT attributed to MEIL parent or consolidated group', () => {
      assert.strictEqual(d25.attributedToMeilGroup, false);
      assert.strictEqual(d24.attributedToMeilGroup, false);
      if (meilHolding) {
        assert.notStrictEqual(d25.reportingEntity.toString(), meilHolding._id.toString());
      }
    });

    console.log('\n--- 3. Testing Financial Year Separation & Precision ---');

    test('FY 2024-25: Scope 1 emissions is exact 17.98 tCO2e', () => {
      assert.strictEqual(d25.ghgEmissions.scope1_tCO2e, 17.98);
    });

    test('FY 2024-25: Scope 2 emissions is exact 3595.00 tCO2e', () => {
      assert.strictEqual(d25.ghgEmissions.scope2_tCO2e, 3595.00);
    });

    test('FY 2024-25: Scope 1+2 intensity is exact 0.02 tCO2e/INR lakh', () => {
      assert.strictEqual(d25.ghgEmissions.scope1And2_Intensity_per_Turnover.value, 0.02);
      assert.strictEqual(d25.ghgEmissions.scope1And2_Intensity_per_Turnover.unit, 'tCO2e/INR lakh');
    });

    test('FY 2024-25: Total energy consumption is exact 25690.7 GJ', () => {
      assert.strictEqual(d25.energyConsumption_GJ.totalEnergy_GJ, 25690.7);
    });

    test('FY 2024-25: Non-renewable energy breakdown is exact (Electricity: 17211.3, Fuel: 6649.7, Other: 1829.8 GJ)', () => {
      assert.strictEqual(d25.energyConsumption_GJ.nonRenewableElectricity_GJ, 17211.3);
      assert.strictEqual(d25.energyConsumption_GJ.nonRenewableFuel_GJ, 6649.7);
      assert.strictEqual(d25.energyConsumption_GJ.otherNonRenewableEnergy_GJ, 1829.8);
    });

    test('FY 2024-25: Renewable energy components are all exactly 0 GJ', () => {
      assert.strictEqual(d25.energyConsumption_GJ.renewableElectricity_GJ, 0);
      assert.strictEqual(d25.energyConsumption_GJ.renewableFuel_GJ, 0);
      assert.strictEqual(d25.energyConsumption_GJ.otherRenewableEnergy_GJ, 0);
    });

    test('FY 2023-24: Scope 1 emissions is exact 46.98 tCO2e', () => {
      assert.strictEqual(d24.ghgEmissions.scope1_tCO2e, 46.98);
    });

    test('FY 2023-24: Scope 2 emissions is exact 6659 tCO2e', () => {
      assert.strictEqual(d24.ghgEmissions.scope2_tCO2e, 6659);
    });

    test('FY 2023-24: Scope 1+2 intensity is exact 0.06 tCO2e/INR lakh', () => {
      assert.strictEqual(d24.ghgEmissions.scope1And2_Intensity_per_Turnover.value, 0.06);
      assert.strictEqual(d24.ghgEmissions.scope1And2_Intensity_per_Turnover.unit, 'tCO2e/INR lakh');
    });

    test('FY 2023-24: Total energy consumption is exact 19153 GJ', () => {
      assert.strictEqual(d24.energyConsumption_GJ.totalEnergy_GJ, 19153);
    });

    test('FY 2023-24: Non-renewable energy breakdown is exact (Electricity: 18309, Fuel: 675, Other: 169 GJ)', () => {
      assert.strictEqual(d24.energyConsumption_GJ.nonRenewableElectricity_GJ, 18309);
      assert.strictEqual(d24.energyConsumption_GJ.nonRenewableFuel_GJ, 675);
      assert.strictEqual(d24.energyConsumption_GJ.otherNonRenewableEnergy_GJ, 169);
    });

    test('FY 2023-24: Renewable energy components are all exactly 0 GJ', () => {
      assert.strictEqual(d24.energyConsumption_GJ.renewableElectricity_GJ, 0);
      assert.strictEqual(d24.energyConsumption_GJ.renewableFuel_GJ, 0);
      assert.strictEqual(d24.energyConsumption_GJ.otherRenewableEnergy_GJ, 0);
    });

    test('Individual reported metric items preserve reported labels and units', () => {
      assert.strictEqual(d25.reportedMetrics.length, 10);
      const scope1Item = d25.reportedMetrics.find(m => m.metricName === 'Scope 1 emissions');
      assert.strictEqual(scope1Item.reportedValue, 17.98);
      assert.strictEqual(scope1Item.reportedUnit, 'tCO2e');
      assert(scope1Item.originalLabelInReport.includes('Scope 1'));
    });

    console.log('\n--- 4. Testing Exclusion from Operational Activity Aggregations ---');

    await testAsync('Published disclosures are NOT stored in MetricEntry operational collection', async () => {
      const metricCount = await MetricEntry.countDocuments({
        $or: [
          { 'activityData.value': 25690.7 },
          { 'calculatedEmissions.co2Tonnes': 17.98 },
          { 'calculatedEmissions.co2Tonnes': 3595 }
        ]
      });
      assert.strictEqual(metricCount, 0, 'No published disclosure numbers must leak into MetricEntry collection');
    });

    await testAsync('Official statutory BRSR report strictly excludes published disclosure figures', async () => {
      let reportData = null;
      const fakeReq = {
        user: { role: 'lead_auditor' },
        query: { financialYear: 'FY 2024-25' }
      };
      const fakeRes = {
        json: (data) => { reportData = data; return fakeRes; },
        status: () => fakeRes
      };

      await reportController.getBRSRSectionC(fakeReq, fakeRes);
      assert(reportData && reportData.success, 'Report generation failed');

      const ind4 = reportData.brsrDisclosure.essentialIndicator4_GHG.table;
      // The report Scope 1 must be the verified operational total (e.g. 55.87 tCO2 or 24.17 tCO2), NOT 17.98 or 3595
      assert.notStrictEqual(ind4.scope1_tCO2, 17.98, 'Report Scope 1 must not equal Olectra published disclosure');
      assert.notStrictEqual(ind4.scope2_LocationBased_tCO2, 3595, 'Report Scope 2 must not equal Olectra published disclosure');
    });

    console.log('\n--- 5. Testing Database Integrity (Zero Destructive Migrations) ---');

    test('Existing entities count and structure remain intact', () => {
      assert(olectraEntity !== null, 'Olectra entity must remain in database');
      assert.strictEqual(olectraEntity.code, 'MEIL-OLECTRA');
    });

    console.log('\n================================================================');
    console.log(` DISCLOSURE TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runDisclosureTests();
}

module.exports = { runDisclosureTests };
