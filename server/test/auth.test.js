const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';

function request(pathStr, options = {}) {
  // Support both /api paths and root paths (like /uploads)
  const fullUrl = pathStr.startsWith('/uploads') ? `http://localhost:5000${pathStr}` : `${BASE_URL}${pathStr}`;
  const url = new URL(fullUrl);

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
        resolve({ status: res.statusCode, data: json, headers: res.headers });
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

async function runTests() {
  console.log('\n================================================================');
  console.log(' RUNNING STAGE A: AUTHENTICATION & AUTHORIZATION SECURITY TESTS');
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

    // -----------------------------------------------------------------
    // 1. Unauthenticated Requests
    // -----------------------------------------------------------------
    console.log('--- 1. Testing Unauthenticated Request Rejections ---');
    const unauthMetrics = await request('/metrics', { method: 'GET' });
    assert(unauthMetrics.status === 401, 'GET /metrics without token rejected with 401');

    const unauthCreate = await request('/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { activityValue: 100 }
    });
    assert(unauthCreate.status === 401, 'POST /metrics without token rejected with 401');

    const unauthPending = await request('/verifications/pending', { method: 'GET' });
    assert(unauthPending.status === 401, 'GET /verifications/pending without token rejected with 401');

    const unauthReview = await request('/verifications/000000000000000000000000/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { action: 'VERIFIED', remarks: 'Test' }
    });
    assert(unauthReview.status === 401, 'POST /verifications/:id/review without token rejected with 401');

    const unauthEntity = await request('/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'Unauthorized Entity', code: 'UNAUTH' }
    });
    assert(unauthEntity.status === 401, 'POST /entities without token rejected with 401');

    const unauthGetEntities = await request('/entities', { method: 'GET' });
    assert(unauthGetEntities.status === 401, 'GET /entities without token rejected with 401');

    const unauthUsers = await request('/auth/users', { method: 'GET' });
    assert(unauthUsers.status === 401, 'Unauthenticated user-listing request (GET /auth/users) rejected with 401');

    const unauthUploads = await request('/uploads/nonexistent-file.pdf', { method: 'GET' });
    assert(unauthUploads.status === 401, 'Unauthenticated evidence download (/uploads/:file) rejected with 401');

    // -----------------------------------------------------------------
    // 2. Role-Based Access Control (RBAC) & Administrative Authorization
    // -----------------------------------------------------------------
    console.log('\n--- 2. Testing Role-Based Authorization Enforcement ---');
    const collector = await login('collector@meil.in', 'meil123'); // site_engineer
    const auditor = await login('auditor@meil.in', 'meil123');     // sustainability_auditor
    const manager = await login('manager@meil.in', 'meil123');     // bu_manager
    const admin = await login('admin@meil.in', 'meil123');         // corporate_admin

    // Site engineer attempting administrative user listing
    const engineerUsersRes = await request('/auth/users', {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(engineerUsersRes.status === 403, 'Site Engineer accessing user directory rejected with 403 Forbidden');

    // Corporate Admin accessing user listing
    const adminUsersRes = await request('/auth/users', {
      headers: { 'Authorization': `Bearer ${admin.token}` }
    });
    assert(adminUsersRes.status === 200, 'Corporate Admin accessing user directory succeeds with 200 OK');
    assert(adminUsersRes.data.users && adminUsersRes.data.users.length > 0, 'Admin receives populated user list');

    // Site engineer attempting to review
    const engineerReview = await request('/verifications/000000000000000000000000/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${collector.token}`
      },
      body: { action: 'VERIFIED', remarks: 'Attempt by site engineer' }
    });
    assert(engineerReview.status === 403, 'Site Engineer review attempt rejected with 403 Forbidden');

    // Site engineer attempting to view pending queue
    const engineerQueue = await request('/verifications/pending', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(engineerQueue.status === 403, 'Site Engineer accessing verification queue rejected with 403 Forbidden');

    // Site engineer attempting to create entity
    const engineerCreateEntity = await request('/entities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${collector.token}`
      },
      body: { name: 'Hacked Entity', code: 'HACK', industrySector: 'Test' }
    });
    assert(engineerCreateEntity.status === 403, 'Site Engineer creating entity rejected with 403 Forbidden');

    // Auditor attempting to create operational metric
    const auditorCreateMetric = await request('/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auditor.token}`
      },
      body: { activityValue: 500 }
    });
    assert(auditorCreateMetric.status === 403, 'Auditor creating operational metric rejected with 403 Forbidden (Maker restriction)');

    // -----------------------------------------------------------------
    // 3. Site-Level Scope & Read Boundary Protections
    // -----------------------------------------------------------------
    console.log('\n--- 3. Testing Site-Level Entity and Metric Read Boundaries ---');

    // Fetch entity list as Admin
    const entitiesRes = await request('/entities', {
      headers: { 'Authorization': `Bearer ${admin.token}` }
    });
    const allEntities = entitiesRes.data.entities || [];
    const assignedEntityId = (collector.user.assignedEntity?._id || collector.user.assignedEntity).toString();
    const foreignEntity = allEntities.find(e => e._id.toString() !== assignedEntityId);

    // 3a. Site Engineer reading entity list gets strictly their assigned entity
    const engineerEntitiesRes = await request('/entities', {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(engineerEntitiesRes.status === 200, 'Site Engineer reading entities succeeds with 200 OK');
    assert(
      engineerEntitiesRes.data.entities.length === 1 && engineerEntitiesRes.data.entities[0]._id.toString() === assignedEntityId,
      'Site Engineer entity read is strictly restricted to assigned entity'
    );

    // 3b. Site Engineer attempting to read a foreign entity by ID
    if (foreignEntity) {
      const foreignEntityRes = await request(`/entities/${foreignEntity._id}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });
      assert(foreignEntityRes.status === 403, 'Site Engineer reading foreign entity by ID rejected with 403 Forbidden');

      // 3c. Site Engineer attempting to query metrics for a foreign entity
      const foreignMetricsQuery = await request(`/metrics?entity=${foreignEntity._id}`, {
        headers: { 'Authorization': `Bearer ${collector.token}` }
      });
      assert(foreignMetricsQuery.status === 403, 'Site Engineer querying metrics of foreign entity rejected with 403 Forbidden');
    }

    // -----------------------------------------------------------------
    // 4. Zero-Trust Client Data Sanitization & Maker-Checker
    // -----------------------------------------------------------------
    console.log('\n--- 4. Testing Zero-Trust Client Data Sanitization ---');
    const factorsRes = await request('/factors', {
      headers: { 'Authorization': `Bearer ${admin.token}` }
    });
    const dieselFactor = factorsRes.data.factors.find(f => f.fuelOrGridType === 'Diesel');

    // Site engineer trying to submit for another entity
    if (foreignEntity) {
      const foreignSubmission = await request('/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${collector.token}`
        },
        body: {
          entityId: foreignEntity._id,
          scope: 1,
          category: 'Liquid Fuel',
          subCategory: 'Unauthorized Site Fuel',
          activityValue: 1000,
          activityUnit: 'Liters',
          emissionFactorId: dieselFactor._id
        }
      });
      assert(foreignSubmission.status === 403, 'Site Engineer submitting data for non-assigned entity rejected with 403');
    }

    // Site engineer submitting with injected approval status and fake username
    const injectedSubmission = await request('/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${collector.token}`
      },
      body: {
        entityId: assignedEntityId,
        scope: 1,
        category: 'Liquid Fuel',
        subCategory: 'Tamper Test DG Set',
        activityValue: 2500,
        activityUnit: 'Liters',
        emissionFactorId: dieselFactor._id,
        financialYear: 'FY 2024-25',
        quarter: 'Q1',
        month: 'April',
        status: 'Verified',
        userName: 'Fake Super Auditor',
        role: 'corporate_admin'
      }
    });

    assert(injectedSubmission.status === 201, 'Valid metric submission created successfully');
    const createdMetric = injectedSubmission.data.metric;
    assert(createdMetric.status === 'Submitted', 'Injected status "Verified" was ignored; forced to "Submitted"');
    assert(createdMetric.reviewHistory[0].performedByName === collector.user.name, 'Injected userName ignored; server used authentic req.user.name');
    assert(createdMetric.reviewHistory[0].performedBy === collector.user.id, 'Submission performedBy bound strictly to authenticated user ID');

    // Maker-Checker Segregation of Duties
    console.log('\n--- 5. Testing Maker-Checker Segregation ---');
    const managerMetricRes = await request('/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${manager.token}`
      },
      body: {
        entityId: (manager.user.assignedEntity?._id || manager.user.assignedEntity).toString(),
        scope: 1,
        category: 'Liquid Fuel',
        subCategory: 'Manager Submittal For Segregation Test',
        activityValue: 1200,
        activityUnit: 'Liters',
        emissionFactorId: dieselFactor._id,
        financialYear: 'FY 2024-25',
        quarter: 'Q1',
        month: 'May'
      }
    });
    const managerMetric = managerMetricRes.data.metric;

    // Manager attempts self-review
    const selfReview = await request(`/verifications/${managerMetric._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${manager.token}`
      },
      body: { action: 'VERIFIED', remarks: 'Self approval attempt' }
    });
    assert(selfReview.status === 403, 'Maker self-review attempt rejected with 403 Forbidden (Maker != Checker)');

    // Independent Auditor review
    const legitimateReview = await request(`/verifications/${managerMetric._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auditor.token}`
      },
      body: {
        action: 'VERIFIED',
        remarks: 'Independent review by accredited auditor Dr. Arun Nambiar.'
      }
    });
    assert(legitimateReview.status === 200, 'Independent Auditor review succeeds with 200 OK');
    assert(legitimateReview.data.metric.status === 'Verified', 'Metric status updated to "Verified"');

    // Site Engineer attempting to read manager's metric by ID (belonging to another entity)
    const engineerReadForeignMetric = await request(`/metrics/${managerMetric._id}`, {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(engineerReadForeignMetric.status === 403, 'Site Engineer reading foreign entity metric by ID rejected with 403 Forbidden');

    // -----------------------------------------------------------------
    // 6. Evidence-File Privacy & Path Traversal Prevention
    // -----------------------------------------------------------------
    console.log('\n--- 6. Testing Evidence-File Privacy & Path Traversal ---');

    // Create a real evidence file in uploads directory for testing with genuine PDF structure
    const uploadDir = path.resolve(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const { generateEvidencePdf } = require('../src/services/pdfGenerator');
    const testFileName = `evidence-test-${Date.now()}.pdf`;
    const testFilePath = path.resolve(uploadDir, testFileName);
    const validPdfBuffer = generateEvidencePdf({
      title: 'Auditor Verification Fuel Receipt',
      invoiceNumber: 'INV-TEST-001',
      vendorName: 'Bharat Petroleum',
      facility: 'MEIL Zojila Site',
      quantity: '5,000 Liters',
      status: 'Verified'
    });
    fs.writeFileSync(testFilePath, validPdfBuffer);

    // Attach document reference to managerMetric (owned by Manager's entity, NOT Site Engineer's entity)
    managerMetric.evidenceDocuments = [{
      originalName: 'test-invoice.pdf',
      fileName: testFileName,
      filePath: `/uploads/${testFileName}`,
      fileType: 'application/pdf',
      fileSize: validPdfBuffer.length,
      invoiceNumber: 'INV-TEST-001',
      uploadedBy: manager.user.id,
      uploadedAt: new Date()
    }];

    // Update managerMetric directly in DB or through upload route
    const MetricEntry = require('../src/models/MetricEntry');
    await MetricEntry.findByIdAndUpdate(managerMetric._id, {
      evidenceDocuments: managerMetric.evidenceDocuments
    });

    // 6a. Unauthenticated download attempt
    const unauthDownload = await request(`/uploads/${testFileName}`);
    assert(unauthDownload.status === 401, 'Unauthenticated evidence download rejected with 401');

    // 6b. Path traversal attempt (e.g. ../../package.json)
    const traversalAttempt = await request('/uploads/..%2f..%2fpackage.json', {
      headers: { 'Authorization': `Bearer ${admin.token}` }
    });
    assert(
      traversalAttempt.status === 400,
      'Path traversal sequence (/uploads/../../package.json) rejected with 400 Bad Request'
    );

    // 6c. Site Engineer attempting to download foreign entity's evidence file
    const engineerForeignEvidence = await request(`/uploads/${testFileName}`, {
      headers: { 'Authorization': `Bearer ${collector.token}` }
    });
    assert(
      engineerForeignEvidence.status === 403,
      'Site Engineer accessing foreign entity evidence file rejected with 403 Forbidden'
    );

    // 6d. Authorized Auditor downloading evidence file
    const auditorEvidenceRes = await request(`/uploads/${testFileName}`, {
      headers: { 'Authorization': `Bearer ${auditor.token}` }
    });
    assert(auditorEvidenceRes.status === 200, 'Authorized Auditor downloading evidence file succeeds with 200 OK');
    assert(auditorEvidenceRes.headers['content-type'] === 'application/pdf', 'Evidence response Content-Type is application/pdf');
    assert(auditorEvidenceRes.headers['content-disposition']?.includes('inline; filename='), 'Evidence response includes Content-Disposition header');
    assert(typeof auditorEvidenceRes.data === 'string' && auditorEvidenceRes.data.startsWith('%PDF-'), 'Evidence download begins with valid %PDF- signature');

    // 6e. Direct browser download with query token (?token=...) MUST BE REJECTED (token exposure eliminated)
    const queryTokenRes = await request(`/uploads/${testFileName}?token=${auditor.token}`);
    assert(
      queryTokenRes.status === 401,
      'Query parameter token exposure (?token=...) rejected with 401 Unauthorized (eliminates JWT leakage in URLs)'
    );

    // 6f. Download via API evidence endpoint (/api/evidence/:filename)
    const apiEvidenceRes = await request(`/evidence/${testFileName}`, {
      headers: { 'Authorization': `Bearer ${auditor.token}` }
    });
    assert(apiEvidenceRes.status === 200, 'Download via /api/evidence/:filename succeeds with 200 OK');
    assert(apiEvidenceRes.headers['content-type'] === 'application/pdf', 'API Evidence response Content-Type is application/pdf');
    assert(typeof apiEvidenceRes.data === 'string' && apiEvidenceRes.data.startsWith('%PDF-'), 'API Evidence download begins with valid %PDF- signature');

    // 6g. Generated BRSR Section C PDF Report export (/api/reports/brsr-pdf)
    const brsrPdfRes = await request('/reports/brsr-pdf', {
      headers: { 'Authorization': `Bearer ${auditor.token}` }
    });
    assert(brsrPdfRes.status === 200, 'BRSR PDF report export succeeds with 200 OK');
    assert(brsrPdfRes.headers['content-type'] === 'application/pdf', 'BRSR PDF Content-Type is application/pdf');
    assert(brsrPdfRes.headers['content-disposition']?.includes('attachment; filename='), 'BRSR PDF includes Content-Disposition header');
    assert(typeof brsrPdfRes.data === 'string' && brsrPdfRes.data.startsWith('%PDF-'), 'BRSR PDF report begins with valid %PDF- signature');

    // Clean up temporary test file
    try { fs.unlinkSync(testFilePath); } catch (e) { }

    // -----------------------------------------------------------------
    // 7. Production Startup JWT Security Verification
    // -----------------------------------------------------------------
    console.log('\n--- 7. Testing Production Startup JWT Security ---');
    const { getJwtSecret } = require('../src/config/jwt');

    // Save current env
    const origSecret = process.env.JWT_SECRET;
    const origEnv = process.env.NODE_ENV;

    // Test missing JWT_SECRET in production
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    let missingSecretThrew = false;
    try {
      getJwtSecret();
    } catch (e) {
      missingSecretThrew = e.message.includes('missing in production');
    }
    assert(missingSecretThrew, 'Production startup fails when JWT_SECRET is absent');

    // Test insecure/short JWT_SECRET in production
    process.env.JWT_SECRET = 'short_insecure_secret';
    let insecureSecretThrew = false;
    try {
      getJwtSecret();
    } catch (e) {
      insecureSecretThrew = e.message.includes('must be at least 32 characters');
    }
    assert(insecureSecretThrew, 'Production startup fails when JWT_SECRET is shorter than 32 characters');

    // Test default/trivial pattern in production
    process.env.JWT_SECRET = 'a_very_long_secret_that_has_default_in_it_1234567890';
    let trivialSecretThrew = false;
    try {
      getJwtSecret();
    } catch (e) {
      trivialSecretThrew = e.message.includes('trivial or default patterns');
    }
    assert(trivialSecretThrew, 'Production startup fails when JWT_SECRET contains trivial patterns');

    // Restore environment
    process.env.JWT_SECRET = origSecret;
    process.env.NODE_ENV = origEnv;

    console.log('\n================================================================');
    console.log(` TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    try { await mongoose.disconnect(); } catch (e) { }
    process.exit(1);
  }
}

runTests();
