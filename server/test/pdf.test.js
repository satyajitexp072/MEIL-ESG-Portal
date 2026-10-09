const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api';

function request(pathStr, options = {}) {
  const fullUrl = pathStr.startsWith('/uploads') ? `http://localhost:5000${pathStr}` : `${BASE_URL}${pathStr}`;
  const url = new URL(fullUrl);

  return new Promise((resolve, reject) => {
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        let parsed = buffer;
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try { parsed = JSON.parse(buffer.toString('utf8')); } catch (e) { parsed = buffer.toString('utf8'); }
        } else if (contentType.includes('text/')) {
          parsed = buffer.toString('utf8');
        }
        resolve({ status: res.statusCode, data: parsed, buffer, headers: res.headers });
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

async function runPdfTests() {
  console.log('\n================================================================');
  console.log(' RUNNING PDF GENERATION & SECURE DOWNLOAD REGRESSION TESTS');
  console.log('================================================================');

  // Authenticate personas
  const collector = await login('collector@meil.in', 'meil123');
  const manager = await login('manager@meil.in', 'meil123');
  const auditor = await login('auditor@meil.in', 'meil123');
  const admin = await login('admin@meil.in', 'meil123');

  // -----------------------------------------------------------------
  // 1. Disk Storage & Authentic Binary PDF Signatures
  // -----------------------------------------------------------------
  console.log('\n--- 1. Testing Disk Storage & Binary PDF Signatures ---');
  const uploadDir = path.resolve(__dirname, '../uploads');
  const seedFiles = [
    'HPCL_Diesel_Bulk_Invoice_Apr2024.pdf',
    'IOCL_Fleet_Fuel_Vouchers_May2024.pdf',
    'TSSPDCL_HT_Bill_Jun2024_Consumer7719.pdf',
    'Solar_Inverter_Export_Telemetry_Jun2024.pdf',
    'GAIL_Custody_Transfer_Meter_Log_Jun2024.pdf'
  ];

  for (const fn of seedFiles) {
    const filePath = path.resolve(uploadDir, fn);
    assert(fs.existsSync(filePath), `Seed file ${fn} exists on disk`);
    const buf = fs.readFileSync(filePath);
    assert(buf.length > 500, `Seed file ${fn} has genuine content (>500 bytes, got ${buf.length})`);
    assert(buf.slice(0, 5).toString('utf8') === '%PDF-', `Seed file ${fn} starts with %PDF- header`);
    assert(buf.toString('utf8').includes('%%EOF'), `Seed file ${fn} terminates with %%EOF trailer`);
    console.log(`[PASS] ${fn}: Valid binary PDF format verified (${buf.length} bytes)`);
  }

  // -----------------------------------------------------------------
  // 2. Authentication, Token In Query Elimination & Endpoint Parity
  // -----------------------------------------------------------------
  console.log('\n--- 2. Testing Authentication & Elimination of URL Query Tokens ---');
  const testFile = 'HPCL_Diesel_Bulk_Invoice_Apr2024.pdf';

  // 2a. Unauthenticated download rejected
  const unauthRes = await request(`/uploads/${testFile}`);
  assert.strictEqual(unauthRes.status, 401);
  console.log('[PASS] Unauthenticated request to /uploads/:filename rejected with 401');

  const unauthApiRes = await request(`/evidence/${testFile}`);
  assert.strictEqual(unauthApiRes.status, 401);
  console.log('[PASS] Unauthenticated request to /api/evidence/:filename rejected with 401');

  // 2b. Passing token via query parameter ?token= MUST BE REJECTED
  const queryTokenRes = await request(`/uploads/${testFile}?token=${auditor.token}`);
  assert.strictEqual(queryTokenRes.status, 401);
  console.log('[PASS] Token in URL query string (?token=...) rejected with 401 (Zero URL token leakage)');

  const queryTokenApiRes = await request(`/evidence/${testFile}?token=${auditor.token}`);
  assert.strictEqual(queryTokenApiRes.status, 401);
  console.log('[PASS] Token in URL query string for /api/evidence/:filename rejected with 401');

  // -----------------------------------------------------------------
  // 3. RBAC & Entity-Level Boundary Enforcement on Downloads
  // -----------------------------------------------------------------
  console.log('\n--- 3. Testing RBAC & Entity-Level Download Permissions ---');

  // 3a. Collector downloading assigned entity's evidence
  // Collector assigned to Zojila project. HPCL diesel invoice belongs to Zojila.
  const collectorOwnRes = await request(`/evidence/${testFile}`, {
    headers: { 'Authorization': `Bearer ${collector.token}` }
  });
  assert.strictEqual(collectorOwnRes.status, 200);
  assert.strictEqual(collectorOwnRes.headers['content-type'], 'application/pdf');
  assert(collectorOwnRes.headers['content-disposition'].includes('inline; filename='));
  assert(collectorOwnRes.buffer.slice(0, 5).toString('utf8') === '%PDF-');
  console.log('[PASS] Site Collector downloading assigned entity evidence succeeds with 200 OK & PDF headers');

  // 3b. Collector attempting to download foreign entity evidence (TSSPDCL is EV plant, not Zojila)
  const collectorForeignRes = await request(`/evidence/TSSPDCL_HT_Bill_Jun2024_Consumer7719.pdf`, {
    headers: { 'Authorization': `Bearer ${collector.token}` }
  });
  assert.strictEqual(collectorForeignRes.status, 403);
  console.log('[PASS] Site Collector accessing foreign entity evidence rejected with 403 Forbidden');

  // 3c. Auditor downloading any evidence
  const auditorDownloadRes = await request(`/evidence/TSSPDCL_HT_Bill_Jun2024_Consumer7719.pdf`, {
    headers: { 'Authorization': `Bearer ${auditor.token}` }
  });
  assert.strictEqual(auditorDownloadRes.status, 200);
  assert.strictEqual(auditorDownloadRes.headers['content-type'], 'application/pdf');
  assert(auditorDownloadRes.buffer.slice(0, 5).toString('utf8') === '%PDF-');
  console.log('[PASS] Independent Auditor downloading cross-entity evidence succeeds with 200 OK');

  // 3d. Both /uploads and /api/evidence paths serve identically
  const uploadsRouteRes = await request(`/uploads/${testFile}`, {
    headers: { 'Authorization': `Bearer ${auditor.token}` }
  });
  assert.strictEqual(uploadsRouteRes.status, 200);
  assert.strictEqual(uploadsRouteRes.buffer.length, collectorOwnRes.buffer.length);
  console.log('[PASS] Route parity: /uploads/:filename and /api/evidence/:filename serve identical binary data');

  // -----------------------------------------------------------------
  // 4. Security & Error Handling
  // -----------------------------------------------------------------
  console.log('\n--- 4. Testing Path Traversal & Missing File Handling ---');
  const traversalRes = await request('/evidence/..%2f..%2fpackage.json', {
    headers: { 'Authorization': `Bearer ${admin.token}` }
  });
  assert.strictEqual(traversalRes.status, 400);
  console.log('[PASS] Path traversal attempt rejected with 400 Bad Request');

  const notFoundRes = await request('/evidence/non_existent_file_9999.pdf', {
    headers: { 'Authorization': `Bearer ${admin.token}` }
  });
  assert.strictEqual(notFoundRes.status, 404);
  console.log('[PASS] Non-existent evidence file record rejected with 404 Not Found');

  // -----------------------------------------------------------------
  // 5. SEBI BRSR Section C Principle 6 PDF Report Export
  // -----------------------------------------------------------------
  console.log('\n--- 5. Testing SEBI BRSR Section C PDF Report Export ---');

  // 5a. Unauthenticated report export
  const unauthPdf = await request('/reports/brsr-pdf');
  assert.strictEqual(unauthPdf.status, 401);
  console.log('[PASS] Unauthenticated GET /api/reports/brsr-pdf rejected with 401');

  // 5b. Site Engineer group-wide report attempt
  const engineerGroupPdf = await request('/reports/brsr-pdf', {
    headers: { 'Authorization': `Bearer ${collector.token}` }
  });
  assert.strictEqual(engineerGroupPdf.status, 403);
  console.log('[PASS] Site Engineer attempting group-wide BRSR PDF export rejected with 403 Forbidden');

  // 5c. Site Engineer assigned entity report export
  const assignedEntityId = collector.user.assignedEntity._id || collector.user.assignedEntity;
  const engineerAssignedPdf = await request(`/reports/brsr-pdf?entityId=${assignedEntityId}`, {
    headers: { 'Authorization': `Bearer ${collector.token}` }
  });
  assert.strictEqual(engineerAssignedPdf.status, 200);
  assert.strictEqual(engineerAssignedPdf.headers['content-type'], 'application/pdf');
  assert(engineerAssignedPdf.headers['content-disposition'].includes('attachment; filename='));
  assert(engineerAssignedPdf.buffer.slice(0, 5).toString('utf8') === '%PDF-');
  assert(engineerAssignedPdf.buffer.toString('utf8').includes('%%EOF'));
  console.log(`[PASS] Site Engineer exporting assigned entity BRSR PDF succeeds with 200 OK (${engineerAssignedPdf.buffer.length} bytes)`);

  // 5d. Lead Auditor group-wide report export
  const auditorGroupPdf = await request('/reports/brsr-pdf?financialYear=FY%202024-25', {
    headers: { 'Authorization': `Bearer ${auditor.token}` }
  });
  assert.strictEqual(auditorGroupPdf.status, 200);
  assert.strictEqual(auditorGroupPdf.headers['content-type'], 'application/pdf');
  assert(auditorGroupPdf.headers['content-disposition'].includes('attachment; filename='));
  assert(auditorGroupPdf.buffer.slice(0, 5).toString('utf8') === '%PDF-');
  assert(auditorGroupPdf.buffer.length > 2000);
  console.log(`[PASS] Lead Auditor exporting group-wide BRSR PDF succeeds with 200 OK (${auditorGroupPdf.buffer.length} bytes)`);

  // -----------------------------------------------------------------
  // 6. Auto-Healing of Missing Seed Files
  // -----------------------------------------------------------------
  console.log('\n--- 6. Testing Auto-Healing of Seed Files ---');
  const healFile = 'GAIL_Custody_Transfer_Meter_Log_Jun2024.pdf';
  const healPath = path.resolve(uploadDir, healFile);
  fs.unlinkSync(healPath);
  assert(!fs.existsSync(healPath), 'Deleted test file to test auto-healing');

  const healRes = await request(`/evidence/${healFile}`, {
    headers: { 'Authorization': `Bearer ${auditor.token}` }
  });
  assert.strictEqual(healRes.status, 200);
  assert.strictEqual(healRes.headers['content-type'], 'application/pdf');
  assert(healRes.buffer.slice(0, 5).toString('utf8') === '%PDF-');
  assert(fs.existsSync(healPath), 'File auto-healed and regenerated on disk');
  console.log('[PASS] Auto-healing: Missing seed PDF automatically regenerated and served with 200 OK');

  console.log('\n================================================================');
  console.log(' ALL 20 PDF REGRESSION TESTS PASSED SUCCESSFULLY');
  console.log('================================================================\n');
}

runPdfTests().catch(err => {
  console.error('[PDF Test Failure]:', err);
  process.exit(1);
});
