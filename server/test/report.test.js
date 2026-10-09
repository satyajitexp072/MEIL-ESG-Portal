/**
 * Focused Regression Test Suite: BRSR Report Generation & Regulatory Integrity
 * 
 * Tests the 6 Critical Correctness Requirements:
 * 1. Missing turnover/denominator: No ₹2,850 Cr fallback; explicitly reports UNAVAILABLE & null intensity.
 * 2. Unverified and rejected metrics: Excluded from totals; reflected only in audit counts.
 * 3. Duplicate aggregation: Slices and IDs deduplicated; duplicates counted in duplicateRecordsSkipped.
 * 4. CO2-only values: Never falsely labeled as CO2e; scope1_tCO2e & scope2_tCO2e are strictly null.
 * 5. Scope 2 dual reporting: Preserves both Location-Based and Market-Based results explicitly.
 * 6. Unauthorized report access: Enforces 401 unauthenticated and 403 Site Engineer restrictions.
 */

const http = require('http');
const mongoose = require('mongoose');
const MetricEntry = require('../src/models/MetricEntry');

const BASE_URL = 'http://localhost:5000/api';

function request(path, options = {}) {
  const url = new URL(BASE_URL + path);
  return new Promise((resolve, reject) => {
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email, password }
  });
  if (!res.data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function runReportTests() {
  console.log('\n================================================================');
  console.log(' RUNNING FOCUSED BRSR REPORT & METHODOLOGY REGRESSION TESTS');
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

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meil_esg_db');

    // -------------------------------------------------------------
    // 1. UNAUTHORIZED REPORT ACCESS & RBAC ENFORCEMENT
    // -------------------------------------------------------------
    console.log('--- 1. Testing Report Endpoint Authentication & Authorization ---');

    // 1a. Unauthenticated GET /reports/brsr-section-c
    const unauthBRSR = await request('/reports/brsr-section-c');
    assert(unauthBRSR.status === 401, 'Unauthenticated GET /reports/brsr-section-c rejected with 401');

    // 1b. Unauthenticated GET /reports/scope3-roadmap
    const unauthScope3 = await request('/reports/scope3-roadmap');
    assert(unauthScope3.status === 401, 'Unauthenticated GET /reports/scope3-roadmap rejected with 401');

    // 1c. Invalid token rejection
    const invalidTokenRes = await request('/reports/brsr-section-c', {
      headers: { 'Authorization': 'Bearer invalid.token.payload' }
    });
    assert(invalidTokenRes.status === 401, 'Invalid Bearer token rejected with 401');

    // Login personas
    const collector = await login('collector@meil.in', 'meil123'); // site_engineer
    const auditor = await login('auditor@meil.in', 'meil123');     // auditor
    const manager = await login('manager@meil.in', 'meil123');     // sustainability_manager

    const assignedEntityId = collector.user.assignedEntity?._id || collector.user.assignedEntity;

    // 1d. Site Engineer attempting group-wide report without entityId parameter
    const engineerGroupReport = await request('/reports/brsr-section-c', {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(engineerGroupReport.status === 403, 'Site Engineer attempting group-wide report rejected with 403 Forbidden');
    assert(
      engineerGroupReport.data.message && engineerGroupReport.data.message.includes('restricted to their assigned entity'),
      'Site Engineer group report error message is explicit'
    );

    // 1e. Site Engineer attempting to view another entity's report
    const nonAssignedEntityId = '6ac890eaa8969fbc9ab787ab'; // MEIL HQ
    const engineerOtherEntityReport = await request(`/reports/brsr-section-c?entityId=${nonAssignedEntityId}`, {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(engineerOtherEntityReport.status === 403, 'Site Engineer accessing other entity report rejected with 403 Forbidden');

    // 1f. Site Engineer successfully accessing assigned entity report
    const engineerAssignedReport = await request(`/reports/brsr-section-c?entityId=${assignedEntityId}`, {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(engineerAssignedReport.status === 200, 'Site Engineer accessing assigned entity report succeeds with 200 OK');
    assert(engineerAssignedReport.data.success === true, 'Assigned entity report returns success: true');

    // 1g. Auditor / Sustainability Manager accessing group-wide report
    const auditorGroupReport = await request('/reports/brsr-section-c', {
      headers: { 'Authorization': `Bearer ${auditor.token}` }
    });
    assert(auditorGroupReport.status === 200, 'Auditor accessing group-wide report succeeds with 200 OK');

    const managerGroupReport = await request('/reports/brsr-section-c', {
      headers: { 'Authorization': `Bearer ${manager.token}` }
    });
    assert(managerGroupReport.status === 200, 'Sustainability Manager accessing group-wide report succeeds with 200 OK');

    // -------------------------------------------------------------
    // 2. MISSING TURNOVER / DENOMINATOR HANDLING (NO FALLBACKS)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Missing Turnover Denominator Integrity ---');

    // Check group report: Confirm turnover is derived from registered entities, NEVER hardcoded 2850
    const disclosure = auditorGroupReport.data.brsrDisclosure;
    assert(disclosure && disclosure.meta, 'Disclosure meta structure exists');
    assert(
      disclosure.meta.consolidatedTurnoverCrores !== 2850,
      'Consolidated turnover is NOT hardcoded to ₹2,850 Cr fallback'
    );
    assert(
      disclosure.meta.consolidatedTurnoverCrores === 2450,
      'Group consolidated turnover is Holding company turnover (₹2,450 Cr), avoiding subsidiary double-counting'
    );
    assert(
      disclosure.meta.consolidatedTurnoverCrores !== 3450,
      'Group turnover does not blindly sum subsidiaries (₹3,450 Cr)'
    );

    // Test a specific entity with zero turnover using admin account
    const admin = await login('admin@meil.in', 'meil123');
    const tempEntityRes = await request('/entities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admin.token}`
      },
      body: {
        name: 'Turnover Test Site Zero Denominator',
        code: `TEST_TURNOVER_${Date.now()}`,
        type: 'ProjectSite',
        industrySector: 'Construction',
        turnoverINR_Crores: 0 // Explicitly 0 / unavailable turnover
      }
    });

    if (tempEntityRes.status === 201 && tempEntityRes.data.entity) {
      const zeroTurnoverEntityId = tempEntityRes.data.entity._id;

      const zeroTurnoverReport = await request(`/reports/brsr-section-c?entityId=${zeroTurnoverEntityId}`, {
        headers: { 'Authorization': `Bearer ${auditor.token}` }
      });

      assert(zeroTurnoverReport.status === 200, 'Report generation for entity with 0 turnover succeeds');
      const zeroDisc = zeroTurnoverReport.data.brsrDisclosure;

      assert(zeroDisc.meta.consolidatedTurnoverCrores === null, 'Turnover reported as null when unconfigured/zero');
      assert(zeroDisc.meta.turnoverStatus === 'UNAVAILABLE', 'turnoverStatus flagged as UNAVAILABLE');
      assert(
        zeroDisc.meta.turnoverUnavailableReason && zeroDisc.meta.turnoverUnavailableReason.includes('not established or reported'),
        'turnoverUnavailableReason explicitly documents missing denominator'
      );

      // Energy intensity when turnover is unavailable
      const energyTable = zeroDisc.essentialIndicator1_Energy.table;
      assert(energyTable.energyIntensityPerTurnoverCrores === null, 'Energy intensity per turnover is null when denominator missing');
      assert(energyTable.intensityStatus === 'DENOMINATOR_UNAVAILABLE', 'Energy intensity status is DENOMINATOR_UNAVAILABLE');
      assert(energyTable.intensityUnit.includes('Turnover data unavailable'), 'Energy intensity unit states Turnover data unavailable');

      // GHG intensity when turnover is unavailable
      const ghgTable = zeroDisc.essentialIndicator4_GHG.table;
      assert(ghgTable.ghgIntensityPerTurnoverCrores === null, 'GHG intensity per turnover is null when denominator missing');
      assert(ghgTable.intensityStatus === 'DENOMINATOR_UNAVAILABLE', 'GHG intensity status is DENOMINATOR_UNAVAILABLE');
      assert(ghgTable.intensityUnit.includes('Turnover data unavailable'), 'GHG intensity unit states Turnover data unavailable');
    }

    // -------------------------------------------------------------
    // 3. UNVERIFIED AND REJECTED METRICS EXCLUSION
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Unverified and Rejected Metric Exclusion ---');

    const factorRes = await request('/factors', {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    const factors = factorRes.data.factors || [];
    const dieselFactor = factors.find(f => f.fuelIdentifier === 'DIESEL_HSD' || f.subCategory?.includes('Stationary'));

    if (dieselFactor && assignedEntityId) {
      const testSliceFY = `FY-TEST-${Date.now()}`;

      // 3a. Submit an unverified metric
      const subRes = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: assignedEntityId,
          scope: 1,
          category: dieselFactor.category,
          subCategory: dieselFactor.subCategory,
          activityType: 'Fuel Combustion',
          fuelOrEnergyType: dieselFactor.fuelOrGridType,
          activityValue: 10000,
          activityUnit: 'Liters',
          emissionFactorId: dieselFactor._id,
          financialYear: testSliceFY,
          quarter: 'Q1',
          month: 'April',
          reportingPeriod: {
            financialYear: testSliceFY,
            quarter: 'Q1',
            month: 'April'
          }
        }
      });

      assert(subRes.status === 201, 'Created unverified test metric entry (status: Submitted)');
      const submittedMetricId = (subRes.data.metric || subRes.data.metricEntry)._id;

      // 3b. Query report for testSliceFY while entry is Submitted
      const unverifiedReport = await request(`/reports/brsr-section-c?financialYear=${testSliceFY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });

      const unvDisc = unverifiedReport.data.brsrDisclosure;
      assert(unvDisc.auditSummary.totalDataPoints >= 1, 'Unverified metric is tracked in totalDataPoints');
      assert(unvDisc.auditSummary.pendingReviewPoints >= 1, 'Unverified metric is tracked in pendingReviewPoints');
      assert(unvDisc.auditSummary.verifiedDataPoints === 0, 'Unverified metric is NOT counted in verifiedDataPoints');
      assert(unvDisc.auditSummary.eligibleAggregatedPoints === 0, 'Unverified metric is NOT included in eligibleAggregatedPoints');
      assert(unvDisc.essentialIndicator1_Energy.table.totalEnergy_MWh === 0, 'Total energy is 0 (unverified entry strictly excluded)');
      assert(unvDisc.essentialIndicator4_GHG.table.scope1_tCO2 === 0, 'Scope 1 emissions are 0 (unverified entry strictly excluded)');

      // 3c. Reject the metric as Auditor
      const rejectRes = await request(`/verifications/${submittedMetricId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auditor.token}`
        },
        body: {
          action: 'REJECTED',
          remarks: 'Rejected for automated regression test verification'
        }
      });
      assert(rejectRes.status === 200, 'Metric transitioned to Rejected status');

      // 3d. Query report again for testSliceFY while entry is Rejected
      const rejectedReport = await request(`/reports/brsr-section-c?financialYear=${testSliceFY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });
      const rejDisc = rejectedReport.data.brsrDisclosure;
      assert(rejDisc.auditSummary.rejectedPoints >= 1, 'Rejected metric is counted in rejectedPoints');
      assert(rejDisc.auditSummary.eligibleAggregatedPoints === 0, 'Rejected metric is strictly excluded from eligibleAggregatedPoints');
      assert(rejDisc.essentialIndicator4_GHG.table.scope1_tCO2 === 0, 'Scope 1 emissions remain 0 (rejected entry strictly excluded)');

      // -------------------------------------------------------------
      // 4. DUPLICATE AGGREGATION & LEGITIMATE MULTIPLE RECORDS
      // -------------------------------------------------------------
      console.log('\n--- 4. Testing Aggregation Integrity & Deduplication ---');

      const dupSliceFY = `FY-DUP-${Date.now()}`;

      // 4a. Multiple legitimate activity records sharing entity, factor, and period with distinct invoices
      const e1Res = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: assignedEntityId,
          scope: 1,
          category: dieselFactor.category,
          subCategory: dieselFactor.subCategory,
          activityType: 'Fuel Combustion',
          fuelOrEnergyType: dieselFactor.fuelOrGridType,
          activityValue: 5000,
          activityUnit: 'Liters',
          emissionFactorId: dieselFactor._id,
          financialYear: dupSliceFY,
          quarter: 'Q2',
          month: 'July',
          invoiceNumber: 'INV-DIESEL-001',
          reportingPeriod: {
            financialYear: dupSliceFY,
            quarter: 'Q2',
            month: 'July'
          }
        }
      });

      const e2Res = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: assignedEntityId,
          scope: 1,
          category: dieselFactor.category,
          subCategory: dieselFactor.subCategory,
          activityType: 'Fuel Combustion',
          fuelOrEnergyType: dieselFactor.fuelOrGridType,
          activityValue: 4000,
          activityUnit: 'Liters',
          emissionFactorId: dieselFactor._id,
          financialYear: dupSliceFY,
          quarter: 'Q2',
          month: 'July',
          invoiceNumber: 'INV-DIESEL-002',
          reportingPeriod: {
            financialYear: dupSliceFY,
            quarter: 'Q2',
            month: 'July'
          }
        }
      });

      assert(e1Res.status === 201 && e2Res.status === 201, 'Created two legitimate activity records for same period with distinct invoices');

      const e1Id = (e1Res.data.metric || e1Res.data.metricEntry)._id;
      const e2Id = (e2Res.data.metric || e2Res.data.metricEntry)._id;

      await request(`/verifications/${e1Id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auditor.token}`
        },
        body: { action: 'VERIFIED', remarks: 'Entry 1 verified' }
      });

      await request(`/verifications/${e2Id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auditor.token}`
        },
        body: { action: 'VERIFIED', remarks: 'Entry 2 verified' }
      });

      // Query report: both legitimate records must contribute to totals
      let dupReport = await request(`/reports/brsr-section-c?financialYear=${dupSliceFY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });

      let dupDisc = dupReport.data.brsrDisclosure;
      assert(dupDisc.auditSummary.eligibleAggregatedPoints === 2, 'Both legitimate records are aggregated into report totals');
      // 5,000 L + 4,000 L = 9,000 L * 0.002686 = 24.17 tCO2
      assert(
        dupDisc.essentialIndicator4_GHG.table.scope1_tCO2 === 24.17,
        `Scope 1 emissions correctly sum both records (24.17 tCO2, got ${dupDisc.essentialIndicator4_GHG.table.scope1_tCO2})`
      );

      // 4b. True duplicate record (duplicate invoice number INV-DIESEL-001) must be discarded
      const e3DupRes = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: assignedEntityId,
          scope: 1,
          category: dieselFactor.category,
          subCategory: dieselFactor.subCategory,
          activityType: 'Fuel Combustion',
          fuelOrEnergyType: dieselFactor.fuelOrGridType,
          activityValue: 5000,
          activityUnit: 'Liters',
          emissionFactorId: dieselFactor._id,
          financialYear: dupSliceFY,
          quarter: 'Q2',
          month: 'July',
          invoiceNumber: 'INV-DIESEL-001', // Duplicate invoice
          reportingPeriod: {
            financialYear: dupSliceFY,
            quarter: 'Q2',
            month: 'July'
          }
        }
      });
      assert(e3DupRes.status === 201, 'Created duplicate entry with identical invoice number');

      const e3Id = (e3DupRes.data.metric || e3DupRes.data.metricEntry)._id;
      await request(`/verifications/${e3Id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auditor.token}`
        },
        body: { action: 'VERIFIED', remarks: 'Auditor blindly verified duplicate' }
      });

      dupReport = await request(`/reports/brsr-section-c?financialYear=${dupSliceFY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });
      dupDisc = dupReport.data.brsrDisclosure;
      assert(dupDisc.auditSummary.duplicateRecordsSkipped >= 1, 'Duplicate record with identical invoice number was discarded');
      assert(dupDisc.auditSummary.eligibleAggregatedPoints === 2, 'Eligible points remains 2 (duplicate discarded)');
      assert(
        dupDisc.essentialIndicator4_GHG.table.scope1_tCO2 === 24.17,
        'Scope 1 emissions remain 24.17 tCO2 (duplicate not double counted)'
      );

      // 4c. Ambiguous identical slices without invoice numbers are aggregated but flagged for review
      const ambigFY = `FY-AMB-${Date.now()}`;
      const amb1Res = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: assignedEntityId,
          scope: 1,
          category: dieselFactor.category,
          subCategory: dieselFactor.subCategory,
          activityType: 'Fuel Combustion',
          fuelOrEnergyType: dieselFactor.fuelOrGridType,
          activityValue: 1000,
          activityUnit: 'Liters',
          emissionFactorId: dieselFactor._id,
          financialYear: ambigFY,
          quarter: 'Q3',
          month: 'October',
          reportingPeriod: {
            financialYear: ambigFY,
            quarter: 'Q3',
            month: 'October'
          }
        }
      });
      const amb2Res = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: assignedEntityId,
          scope: 1,
          category: dieselFactor.category,
          subCategory: dieselFactor.subCategory,
          activityType: 'Fuel Combustion',
          fuelOrEnergyType: dieselFactor.fuelOrGridType,
          activityValue: 1000,
          activityUnit: 'Liters',
          emissionFactorId: dieselFactor._id,
          financialYear: ambigFY,
          quarter: 'Q3',
          month: 'October',
          reportingPeriod: {
            financialYear: ambigFY,
            quarter: 'Q3',
            month: 'October'
          }
        }
      });
      const amb1Id = (amb1Res.data.metric || amb1Res.data.metricEntry)._id;
      const amb2Id = (amb2Res.data.metric || amb2Res.data.metricEntry)._id;

      await request(`/verifications/${amb1Id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auditor.token}` },
        body: { action: 'VERIFIED', remarks: 'Amb 1 verified' }
      });
      await request(`/verifications/${amb2Id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auditor.token}` },
        body: { action: 'VERIFIED', remarks: 'Amb 2 verified' }
      });

      const ambReport = await request(`/reports/brsr-section-c?financialYear=${ambigFY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });
      const ambDisc = ambReport.data.brsrDisclosure;
      assert(ambDisc.auditSummary.eligibleAggregatedPoints === 2, 'Ambiguous identical slices both contribute to totals');
      assert(ambDisc.auditSummary.flaggedDuplicatesForReview.length >= 1, 'Ambiguous identical slice flagged for audit review without discarding');

      // -------------------------------------------------------------
      // 5. CO2-ONLY VALUES NEVER LABELED AS CO2e
      // -------------------------------------------------------------
      console.log('\n--- 5. Testing CO2 vs CO2e Gas Coverage Integrity ---');

      // In dupDisc, Scope 1 is diesel (CO2_ONLY)
      const ghgIndicator = dupDisc.essentialIndicator4_GHG;
      assert(ghgIndicator.gasCoverage === 'CO2_ONLY', 'gasCoverage is strictly CO2_ONLY');
      assert(ghgIndicator.table.scope1_tCO2 === 24.17, 'scope1_tCO2 expresses pure CO2 mass (24.17 tCO2)');
      assert(ghgIndicator.table.scope1_tCO2e === null, 'scope1_tCO2e is strictly null when factor is CO2_ONLY');
      assert(ghgIndicator.table.scope2_tCO2e === null, 'scope2_tCO2e is strictly null');
      assert(ghgIndicator.table.scope2_LocationBased_tCO2e === null, 'scope2_LocationBased_tCO2e is strictly null');
      assert(ghgIndicator.table.scope2_MarketBased_tCO2e === null, 'scope2_MarketBased_tCO2e is strictly null');
      assert(ghgIndicator.table.totalScope1And2_tCO2e === null, 'totalScope1And2_tCO2e is strictly null');
      assert(
        ghgIndicator.gasCoverageNote.includes('CO2_ONLY') && ghgIndicator.gasCoverageNote.includes('NOT reported as CO2e'),
        'gasCoverageNote explicitly warns non-CO2 GHGs are unquantified'
      );

      // -------------------------------------------------------------
      // 6. SCOPE 2 LOCATION VS MARKET DUAL REPORTING
      // -------------------------------------------------------------
      console.log('\n--- 6. Testing Scope 2 Location vs Market Dual Reporting ---');

      const gridFactor = factors.find(f => f.fuelIdentifier === 'GRID_ELECTRICITY_IN' || f.accountingMethod === 'Location-Based');
      const solarFactor = factors.find(f => f.accountingMethod === 'Market-Based' || f.isRenewable === true);

      assert(gridFactor !== undefined, 'Found CEA Location-Based grid factor');
      assert(solarFactor !== undefined, 'Found Market-Based renewable factor');

      // 6a. Location-based grid power with no contractual instruments
      const scope2FY = `FY-S2-${Date.now()}`;
      const gridMetricRes = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: assignedEntityId,
          scope: 2,
          category: gridFactor.category,
          subCategory: gridFactor.subCategory,
          activityType: 'Purchased Electricity',
          fuelOrEnergyType: gridFactor.fuelOrGridType,
          activityValue: 100000, // 100,000 kWh = 100 MWh
          activityUnit: 'kWh',
          emissionFactorId: gridFactor._id,
          financialYear: scope2FY,
          quarter: 'Q1',
          month: 'April',
          reportingPeriod: {
            financialYear: scope2FY,
            quarter: 'Q1',
            month: 'April'
          }
        }
      });

      // Verify grid metric as Auditor
      const gridMetricId = (gridMetricRes.data.metric || gridMetricRes.data.metricEntry)._id;
      await request(`/verifications/${gridMetricId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auditor.token}`
        },
        body: { action: 'VERIFIED', remarks: 'Verified grid metric' }
      });

      const scope2Report = await request(`/reports/brsr-section-c?financialYear=${scope2FY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });

      const s2Disc = scope2Report.data.brsrDisclosure;
      const s2Table = s2Disc.essentialIndicator4_GHG.table;

      // 100 MWh * 0.716 tCO2/MWh = 71.60 tCO2
      assert(s2Table.scope2_LocationBased_tCO2 === 71.6, `scope2_LocationBased_tCO2 is 71.60 tCO2 (got ${s2Table.scope2_LocationBased_tCO2})`);
      assert(s2Table.scope2_MarketBased_tCO2 === null, 'scope2_MarketBased_tCO2 is null when no market contractual instruments exist');
      assert(s2Table.scope2_MarketBasedStatus === 'UNAVAILABLE', 'scope2_MarketBasedStatus is UNAVAILABLE (no market instruments in boundary)');
      assert(s2Table.scope2_Reportable_tCO2 === 71.6, 'scope2_Reportable_tCO2 is 71.60 tCO2');
      assert(s2Table.scope2_tCO2e === null, 'scope2_tCO2e is strictly null (CEA grid factor models CO2 only)');

      // 6b. Independent aggregation with market-based contractual instrument
      const scope2DualFY = `FY-S2DUAL-${Date.now()}`;

      // Submit grid power
      const gRes = await request('/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${collector.token}` },
        body: {
          entityId: assignedEntityId,
          scope: 2,
          category: gridFactor.category,
          subCategory: gridFactor.subCategory,
          activityType: 'Purchased Electricity',
          fuelOrEnergyType: gridFactor.fuelOrGridType,
          activityValue: 100000, // 100 MWh
          activityUnit: 'kWh',
          emissionFactorId: gridFactor._id,
          financialYear: scope2DualFY,
          quarter: 'Q1',
          month: 'April',
          reportingPeriod: { financialYear: scope2DualFY, quarter: 'Q1', month: 'April' }
        }
      });

      // Submit solar power (Market-Based)
      const solRes = await request('/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${collector.token}` },
        body: {
          entityId: assignedEntityId,
          scope: 2,
          category: solarFactor.category,
          subCategory: solarFactor.subCategory,
          activityType: 'Renewable Generation',
          fuelOrEnergyType: solarFactor.fuelOrGridType,
          activityValue: 50, // 50 MWh
          activityUnit: 'MWh',
          emissionFactorId: solarFactor._id,
          financialYear: scope2DualFY,
          quarter: 'Q1',
          month: 'April',
          reportingPeriod: { financialYear: scope2DualFY, quarter: 'Q1', month: 'April' }
        }
      });

      const gId = (gRes.data.metric || gRes.data.metricEntry)._id;
      const solId = (solRes.data.metric || solRes.data.metricEntry)._id;

      // Attach qualifying SCADA generation telemetry evidence to captive solar metric
      await MetricEntry.findByIdAndUpdate(solId, {
        evidenceDocuments: [{
          originalName: 'captive_solar_scada_telemetry.pdf',
          fileName: 'captive_solar_scada_telemetry.pdf',
          filePath: '/uploads/captive_solar_scada_telemetry.pdf',
          fileType: 'application/pdf',
          documentType: 'CAPTIVE_SOLAR_SCADA_LOG',
          invoiceNumber: 'INV-SOLAR-001'
        }]
      });

      await request(`/verifications/${gId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auditor.token}` },
        body: { action: 'VERIFIED', remarks: 'Grid verified' }
      });

      await request(`/verifications/${solId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auditor.token}` },
        body: {
          action: 'VERIFIED',
          verifiedScope2Claim: true,
          remarks: 'Verified captive solar generation log and SCADA telemetry'
        }
      });

      const dualReport = await request(`/reports/brsr-section-c?financialYear=${scope2DualFY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });

      const dualTable = dualReport.data.brsrDisclosure.essentialIndicator4_GHG.table;
      // 100 MWh grid (71.60 tCO2) + 50 MWh solar location baseline (35.80 tCO2) = 107.40 tCO2
      assert(dualTable.scope2_LocationBased_tCO2 === 107.4, `Location-based emissions correctly aggregated total volume (107.40 tCO2, got ${dualTable.scope2_LocationBased_tCO2})`);
      // 100 MWh grid proxy (71.60 tCO2) + 50 MWh verified zero solar (0.00 tCO2) = 71.60 tCO2
      assert(dualTable.scope2_MarketBased_tCO2 === 71.6, `Market-based emissions independently aggregated (71.60 tCO2, got ${dualTable.scope2_MarketBased_tCO2})`);
      assert(dualTable.scope2_MarketBasedStatus === 'REPORTED', 'Market-based status is REPORTED when contractual instrument present');
      assert(dualTable.scope2_LocationBased_tCO2 !== dualTable.scope2_MarketBased_tCO2, 'Location-based and Market-based results differ and remain distinct');

      // 6c. Pure 100% renewable solar generation slice
      const solarOnlyFY = `FY-SOLAR-${Date.now()}`;
      const solOnlyRes = await request('/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${collector.token}` },
        body: {
          entityId: assignedEntityId,
          scope: 2,
          category: solarFactor.category,
          subCategory: solarFactor.subCategory,
          activityType: 'Renewable Generation',
          fuelOrEnergyType: solarFactor.fuelOrGridType,
          activityValue: 50,
          activityUnit: 'MWh',
          emissionFactorId: solarFactor._id,
          financialYear: solarOnlyFY,
          quarter: 'Q1',
          month: 'April',
          reportingPeriod: { financialYear: solarOnlyFY, quarter: 'Q1', month: 'April' }
        }
      });
      const soId = (solOnlyRes.data.metric || solOnlyRes.data.metricEntry)._id;
      await MetricEntry.findByIdAndUpdate(soId, {
        evidenceDocuments: [{
          originalName: 'solar_telemetry.pdf',
          fileName: 'solar_telemetry.pdf',
          filePath: '/uploads/solar_telemetry.pdf',
          documentType: 'CAPTIVE_SOLAR_SCADA_LOG'
        }]
      });
      await request(`/verifications/${soId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auditor.token}` },
        body: { action: 'VERIFIED', verifiedScope2Claim: true, remarks: 'Verified solar' }
      });
      const solOnlyReport = await request(`/reports/brsr-section-c?financialYear=${solarOnlyFY}&entityId=${assignedEntityId}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });
      const soTable = solOnlyReport.data.brsrDisclosure.essentialIndicator4_GHG.table;
      assert(soTable.scope2_LocationBased_tCO2 === 35.8, 'Solar-only slice preserves location baseline (35.80 tCO2)');
      assert(soTable.scope2_MarketBased_tCO2 === 0, 'Solar-only slice yields 0.00 tCO2 under Market-Based method');
      assert(soTable.scope2_MarketBasedStatus === 'REPORTED', 'Solar-only status is REPORTED');
    }
  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  } finally {
    try { await mongoose.disconnect(); } catch (e) { }
  }

  console.log('\n================================================================');
  console.log(` REPORT REGRESSION TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runReportTests();
