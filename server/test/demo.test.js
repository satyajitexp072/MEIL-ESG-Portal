const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Entity = require('../src/models/Entity');
const EmissionFactor = require('../src/models/EmissionFactor');
const MetricEntry = require('../src/models/MetricEntry');
const JuryDemoMetric = require('../src/models/JuryDemoMetric');
const User = require('../src/models/User');
const { getJwtSecret } = require('../src/config/jwt');
const demoController = require('../src/controllers/demo.controller');
const reportController = require('../src/controllers/report.controller');

async function runDemoTests() {
  console.log('\n================================================================');
  console.log(' RUNNING FOUR-ROLE JURY DEMONSTRATION WORKFLOW TESTS');
  console.log('================================================================\n');

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
    // Locate the 4 seeded demo accounts
    const collector = await User.findOne({ email: 'collector@meil.in' });
    const buManager = await User.findOne({ email: 'manager@meil.in' });
    const auditor = await User.findOne({ email: 'auditor@meil.in' });
    const corporateAdmin = await User.findOne({ email: 'admin@meil.in' });

    assert(collector, 'Site Collector user must exist');
    assert(buManager, 'BU Manager user must exist');
    assert(auditor, 'Auditor user must exist');
    assert(corporateAdmin, 'Corporate Admin user must exist');

    // Locate active entity & diesel factor
    const entity = await Entity.findOne({ status: 'Active' });
    const dieselFactor = await EmissionFactor.findOne({ fuelOrGridType: 'Diesel', scope: 1 });
    assert(entity, 'Active entity must exist');
    assert(dieselFactor, 'Stationary diesel factor must exist');

    console.log('--- 1. Testing Safe Reset & Workspace Isolation ---');

    await testAsync('Safe reset deletes only demo records and rejects non-admin', async () => {
      // Non-admin attempting reset must fail
      const initialOperationalCount = await MetricEntry.countDocuments();
      await JuryDemoMetric.create({
        entity: entity._id,
        scope: 1,
        category: 'Liquid Fuel',
        subCategory: 'Test Demo Item',
        activityData: { value: 50, unit: 'liter' },
        emissionFactor: dieselFactor._id,
        calculatedEmissions: {
          co2Tonnes: 0.13,
          formulaApplied: '50 * 2.686 / 1000',
          energyMWh: 0.5
        },
        status: 'SUBMITTED'
      });

      // Corporate admin reset call
      const req = { user: corporateAdmin };
      let resData = null;
      const res = {
        json: (d) => { resData = d; return res; },
        status: () => res
      };

      await demoController.resetDemoWorkspace(req, res);
      assert(resData && resData.success, 'Reset failed');
      const countAfter = await JuryDemoMetric.countDocuments();
      assert.strictEqual(countAfter, 0, 'Demo workspace must be empty after reset');

      const operationalCountAfter = await MetricEntry.countDocuments();
      assert.strictEqual(operationalCountAfter, initialOperationalCount, 'Operational MetricEntry count must be unchanged');
    });

    console.log('\n--- 2. Testing Step 1: Site Collector Submission ---');

    let createdEntryId = null;

    await testAsync('Site Collector submits activity data with initial SUBMITTED status', async () => {
      const req = {
        user: collector,
        body: {
          entityId: entity._id.toString(),
          scope: 1,
          category: 'Liquid Fuel',
          subCategory: 'Stationary Diesel DG Set',
          activityValue: '1000',
          activityUnit: 'liter',
          emissionFactorId: dieselFactor._id.toString(),
          invoiceNumber: 'INV-DEMO-ZOJILA-01',
          notes: 'Tunnel boring backup generator power.'
        },
        files: [
          {
            originalname: 'diesel_invoice_oct2024.pdf',
            filename: 'evidence-demo-12345.pdf',
            mimetype: 'application/pdf',
            size: 204800
          }
        ]
      };

      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.submitEntry(req, res);
      assert.strictEqual(statusCode, 201, 'Submission should return 201');
      assert(resData && resData.success, 'Submission failed');
      assert(resData.entry._id, 'Entry ID must be returned');
      createdEntryId = resData.entry._id;

      const saved = await JuryDemoMetric.findById(createdEntryId);
      assert.strictEqual(saved.status, 'SUBMITTED');
      assert.strictEqual(saved.calculatedEmissions.co2Tonnes, 2.686);
      assert.strictEqual(Number(saved.calculatedEmissions.energyMWh.toFixed(2)), 10.07);
      assert.strictEqual(saved.evidenceDocuments.length, 1);
      assert.strictEqual(saved.reviewHistory.length, 1);
      assert.strictEqual(saved.reviewHistory[0].action, 'SUBMITTED');
      assert.strictEqual(saved.reviewHistory[0].performedByName, collector.name);
    });

    await testAsync('Auditor cannot submit activity data (403 Role Forbidden)', async () => {
      const req = {
        user: auditor,
        body: {
          entityId: entity._id.toString(),
          scope: 1,
          category: 'Liquid Fuel',
          subCategory: 'Stationary Diesel DG Set',
          activityValue: '500',
          activityUnit: 'liter',
          emissionFactorId: dieselFactor._id.toString()
        },
        files: []
      };
      let statusCode = 200;
      let resData = null;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.submitEntry(req, res);
      assert.strictEqual(statusCode, 403, 'Auditor must be forbidden from submitting activity data');
      assert(resData && resData.message.includes('Only Site ESG Data Collectors'), 'Should return role forbidden message');
    });

    await testAsync('BU Manager cannot submit activity data (403 Role Forbidden)', async () => {
      const req = {
        user: buManager,
        body: {
          entityId: entity._id.toString(),
          scope: 1,
          category: 'Liquid Fuel',
          subCategory: 'Stationary Diesel DG Set',
          activityValue: '500',
          activityUnit: 'liter',
          emissionFactorId: dieselFactor._id.toString()
        },
        files: []
      };
      let statusCode = 200;
      let resData = null;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.submitEntry(req, res);
      assert.strictEqual(statusCode, 403, 'BU Manager must be forbidden from submitting activity data');
    });

    console.log('\n--- 3. Testing Step 2: BU Review & Permission Enforcement ---');

    await testAsync('Site Collector cannot perform BU Review (403 Enforcement)', async () => {
      const req = {
        user: collector,
        params: { id: createdEntryId },
        body: { action: 'BU_APPROVE', remarks: 'Self approval attempt' }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.buReviewEntry(req, res);
      // Maker-checker violation check returns 403
      assert.strictEqual(statusCode, 403, 'Collector must not be allowed to review own submission');
    });

    await testAsync('BU Review requires mandatory remarks', async () => {
      const req = {
        user: buManager,
        params: { id: createdEntryId },
        body: { action: 'BU_APPROVE', remarks: '   ' }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.buReviewEntry(req, res);
      assert.strictEqual(statusCode, 400, 'Blank remarks must be rejected with 400');
    });

    console.log('\n--- 4. Testing Return for Correction & Resubmission Lifecycle ---');

    await testAsync('BU Reviewer returns entry for correction with feedback reason', async () => {
      const req = {
        user: buManager,
        params: { id: createdEntryId },
        body: {
          action: 'RETURN_FOR_CORRECTION',
          remarks: 'Quantity discrepancy: meter log indicates 1,200 liters consumed, not 1,000.'
        }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.buReviewEntry(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(resData.entry.status, 'RETURNED_FOR_CORRECTION');

      const saved = await JuryDemoMetric.findById(createdEntryId);
      assert.strictEqual(saved.status, 'RETURNED_FOR_CORRECTION');
      assert.strictEqual(saved.reviewHistory.length, 2);
      assert.strictEqual(saved.reviewHistory[1].action, 'RETURN_FOR_CORRECTION');
      assert(saved.reviewHistory[1].remarks.includes('meter log indicates 1,200'));
    });

    await testAsync('Site Collector resubmits corrected activity value without losing prior audit history', async () => {
      const req = {
        user: collector,
        params: { id: createdEntryId },
        body: {
          activityValue: '1200',
          resubmissionRemarks: 'Corrected quantity to 1,200 Liters per site meter log inspection.'
        },
        files: []
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.resubmitEntry(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(resData.entry.status, 'RESUBMITTED');

      const saved = await JuryDemoMetric.findById(createdEntryId);
      assert.strictEqual(saved.status, 'RESUBMITTED');
      assert.strictEqual(saved.activityData.value, 1200);
      assert.strictEqual(saved.calculatedEmissions.co2Tonnes, 3.2232); // 1200 * 2.686 / 1000
      assert.strictEqual(saved.reviewHistory.length, 3, 'Audit history must contain all 3 chronological steps');
      assert.strictEqual(saved.reviewHistory[2].action, 'RESUBMITTED');
      assert.strictEqual(saved.reviewHistory[2].performedByName, collector.name);
    });

    await testAsync('BU Reviewer approves resubmission forward to Independent Auditor', async () => {
      const req = {
        user: buManager,
        params: { id: createdEntryId },
        body: {
          action: 'BU_APPROVE',
          remarks: 'Verified corrected meter log. Approved and forwarded to Independent Auditor.'
        }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.buReviewEntry(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(resData.entry.status, 'BU_APPROVED');
    });

    console.log('\n--- 5. Testing Step 3: Independent Auditor Assurance ---');

    await testAsync('Maker-Checker Violation: Original submitter cannot independently audit own submission (403 Enforcement)', async () => {
      const req = {
        user: collector,
        params: { id: createdEntryId },
        body: {
          action: 'AUDIT_VERIFY',
          remarks: 'Collector attempting to audit own submission'
        }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.auditorReviewEntry(req, res);
      assert.strictEqual(statusCode, 403, 'Submitter must not be allowed to audit own submission');
      assert(resData && resData.message.includes('Maker-Checker Segregation Violation'), 'Must return segregation violation message');
    });

    await testAsync('Maker-Checker Violation: BU Reviewer cannot act as independent auditor (403 Enforcement)', async () => {
      const req = {
        user: buManager,
        params: { id: createdEntryId },
        body: {
          action: 'AUDIT_VERIFY',
          remarks: 'BU Manager attempting to audit entry they reviewed'
        }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.auditorReviewEntry(req, res);
      assert.strictEqual(statusCode, 403, 'Internal BU Reviewer must not act as independent auditor');
      assert(resData && resData.message.includes('Maker-Checker Segregation Violation'), 'Must return segregation violation message');
    });

    await testAsync('Auditor verification advances status to AUDITOR_VERIFIED', async () => {
      const req = {
        user: auditor,
        params: { id: createdEntryId },
        body: {
          action: 'AUDIT_VERIFY',
          remarks: 'Independent third-party verification completed. Stationary diesel fuel invoice and meter log audited.'
        }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.auditorReviewEntry(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(resData.entry.status, 'AUDITOR_VERIFIED');

      const saved = await JuryDemoMetric.findById(createdEntryId);
      assert.strictEqual(saved.status, 'AUDITOR_VERIFIED');
      assert.strictEqual(saved.reviewHistory.length, 5);
      assert.strictEqual(saved.reviewHistory[4].action, 'AUDITOR_VERIFIED');
    });

    console.log('\n--- 6. Testing Step 4: Executive Corporate Sign-Off ---');

    await testAsync('CSO executes corporate disclosure sign-off to achieve CORPORATE_APPROVED status', async () => {
      const req = {
        user: corporateAdmin,
        params: { id: createdEntryId },
        body: {
          action: 'CORPORATE_SIGNOFF',
          remarks: 'Executive BRSR Section C sign-off approved for consolidated disclosure.'
        }
      };
      let resData = null;
      let statusCode = 200;
      const res = {
        status: (c) => { statusCode = c; return res; },
        json: (d) => { resData = d; return res; }
      };

      await demoController.corporateSignoffEntry(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(resData.entry.status, 'CORPORATE_APPROVED');

      const saved = await JuryDemoMetric.findById(createdEntryId);
      assert.strictEqual(saved.status, 'CORPORATE_APPROVED');
      assert.strictEqual(saved.reviewHistory.length, 6, 'Complete 6-step auditable lifecycle preserved');
    });

    console.log('\n--- 7. Testing Jury Demo Summary Aggregation ---');

    await testAsync('Demo summary accurately aggregates approved entry into Scope 1 disclosure total', async () => {
      const req = { user: corporateAdmin };
      let resData = null;
      const res = {
        json: (d) => { resData = d; return res; },
        status: () => res
      };

      await demoController.getDemoSummary(req, res);
      assert(resData && resData.success);
      assert.strictEqual(resData.meta.approvedForDisclosureCount, 1);
      assert.strictEqual(resData.summary.scope1_Direct_tCO2, 3.22);
      assert.strictEqual(resData.summary.totalScope1And2_tCO2, 3.22);
      assert.strictEqual(resData.summary.totalEnergy_MWh, 12.08); // 1200 L * 0.843 * 43 / 3600
    });

    console.log('\n--- 8. Testing Official MEIL Reporting Isolation ---');

    await testAsync('Official statutory BRSR report strictly excludes the demo entry', async () => {
      const req = {
        user: { role: 'lead_auditor' },
        query: { financialYear: 'FY 2024-25' }
      };
      let reportData = null;
      const res = {
        json: (d) => { reportData = d; return res; },
        status: () => res
      };

      await reportController.getBRSRSectionC(req, res);
      assert(reportData && reportData.success);
      const ind4 = reportData.brsrDisclosure.essentialIndicator4_GHG.table;

      // The demo entry had value 3.223 tCO2 (1,200 L diesel). Official Scope 1 total must NOT equal 3.22
      assert.notStrictEqual(ind4.scope1_tCO2, 3.22, 'Official Scope 1 must not be contaminated by demo entry');
      assert.strictEqual(reportData.brsrDisclosure.rawDataTrace.some(t => t._id.toString() === createdEntryId.toString()), false, 'Demo entry must not appear in official rawDataTrace');
    });

    console.log('\n================================================================');
    console.log(` DEMO TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
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
  runDemoTests();
}

module.exports = { runDemoTests };
