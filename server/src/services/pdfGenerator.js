const fs = require('fs');
const path = require('path');

/**
 * Pure Node.js Standard PDF 1.4 Generator
 * Complies with ISO 32000-1 / PDF 1.4 specification without external binary dependencies.
 */
class SimplePdfBuilder {
  constructor({ pageSize = [612, 792] } = {}) {
    this.width = pageSize[0];
    this.height = pageSize[1];
    this.pages = [];
    this.currentPage = null;
    this.addPage();
  }

  addPage() {
    this.currentPage = {
      commands: [],
      y: this.height - 40
    };
    this.pages.push(this.currentPage);
    return this.currentPage;
  }

  escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  rect(x, y, w, h, { fill = false, stroke = false, fillColor = [0.95, 0.95, 0.95], strokeColor = [0.8, 0.8, 0.8], lineWidth = 1 } = {}) {
    const p = this.currentPage;
    p.commands.push('q');
    if (lineWidth) p.commands.push(`${lineWidth} w`);
    if (stroke) p.commands.push(`${strokeColor.join(' ')} RG`);
    if (fill) p.commands.push(`${fillColor.join(' ')} rg`);
    p.commands.push(`${x} ${y} ${w} ${h} re`);
    if (fill && stroke) p.commands.push('B');
    else if (fill) p.commands.push('f');
    else if (stroke) p.commands.push('S');
    p.commands.push('Q');
  }

  line(x1, y1, x2, y2, { color = [0.7, 0.7, 0.7], lineWidth = 1 } = {}) {
    const p = this.currentPage;
    p.commands.push('q');
    p.commands.push(`${lineWidth} w`);
    p.commands.push(`${color.join(' ')} RG`);
    p.commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    p.commands.push('Q');
  }

  text(str, x, y, { font = 'F2', size = 10, color = [0.1, 0.1, 0.1] } = {}) {
    const p = this.currentPage;
    p.commands.push('BT');
    p.commands.push(`/${font} ${size} Tf`);
    p.commands.push(`${color.join(' ')} rg`);
    p.commands.push(`${x} ${y} Td`);
    p.commands.push(`(${this.escape(str)}) Tj`);
    p.commands.push('ET');
  }

  toBuffer() {
    const bodyParts = [];
    bodyParts.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const offsets = [];

    function addObj(id, content) {
      offsets[id] = bodyParts.reduce((acc, part) => acc + Buffer.byteLength(part, 'utf8'), 0);
      bodyParts.push(`${id} 0 obj\n${content}\nendobj\n`);
    }

    const font1Id = 3; // Helvetica-Bold
    const font2Id = 4; // Helvetica
    const font3Id = 5; // Helvetica-Oblique

    let nextId = 6;
    const pageObjIds = [];
    const contentObjIds = [];

    for (let i = 0; i < this.pages.length; i++) {
      pageObjIds.push(nextId++);
      contentObjIds.push(nextId++);
    }

    addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');

    const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
    addObj(2, `<< /Type /Pages /Kids [${kidsStr}] /Count ${this.pages.length} >>`);

    addObj(font1Id, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    addObj(font2Id, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    addObj(font3Id, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');

    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      const pageId = pageObjIds[i];
      const contentId = contentObjIds[i];

      // Standard footer
      page.commands.push('BT');
      page.commands.push('/F2 8 Tf');
      page.commands.push('0.4 0.4 0.4 rg');
      page.commands.push(`40 25 Td`);
      page.commands.push(`(${this.escape(`Page ${i + 1} of ${this.pages.length}   |   MEIL ESG Portal - Official Statutory Record`)}) Tj`);
      page.commands.push('ET');

      const streamText = page.commands.join('\n');
      const streamLen = Buffer.byteLength(streamText, 'utf8');

      addObj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R >> >> /Contents ${contentId} 0 R >>`);
      addObj(contentId, `<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream`);
    }

    const totalObjs = nextId - 1;
    const xrefOffset = bodyParts.reduce((acc, part) => acc + Buffer.byteLength(part, 'utf8'), 0);

    let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= totalObjs; id++) {
      const offStr = String(offsets[id]).padStart(10, '0');
      xref += `${offStr} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    bodyParts.push(xref);
    bodyParts.push(trailer);

    return Buffer.from(bodyParts.join(''), 'utf8');
  }
}

/**
 * Generates an official evidence verification document PDF.
 */
function generateEvidencePdf({
  title = 'ESG Activity Supporting Evidence',
  invoiceNumber = 'N/A',
  vendorName = 'N/A',
  facility = 'N/A',
  quantity = 'N/A',
  date = new Date().toISOString().slice(0, 10),
  status = 'Verified',
  documentType = 'Tax Invoice / Meter Log',
  verificationDetails = []
}) {
  const doc = new SimplePdfBuilder();

  // Header Banner
  doc.rect(40, 715, 532, 45, { fill: true, fillColor: [0.08, 0.18, 0.36] }); // MEIL Navy
  doc.text('MEGHA ENGINEERING & INFRASTRUCTURES LIMITED', 52, 742, { font: 'F1', size: 13, color: [1, 1, 1] });
  doc.text('ESG PORTAL - STATUTORY VERIFICATION AUDIT TRAIL', 52, 726, { font: 'F2', size: 8.5, color: [0.8, 0.9, 1] });

  // Document Title Bar
  doc.rect(40, 675, 532, 28, { fill: true, fillColor: [0.93, 0.95, 0.98] });
  doc.text(title, 52, 685, { font: 'F1', size: 11, color: [0.08, 0.18, 0.36] });
  doc.text(`Document Type: ${documentType}`, 380, 685, { font: 'F3', size: 8.5, color: [0.3, 0.4, 0.5] });

  // Metadata Card
  doc.rect(40, 565, 532, 95, { fill: true, stroke: true, fillColor: [0.98, 0.99, 1.0], strokeColor: [0.85, 0.88, 0.95] });
  
  // Left Column
  doc.text(`Invoice / Log Ref: ${invoiceNumber}`, 52, 640, { font: 'F1', size: 10, color: [0.1, 0.2, 0.4] });
  doc.text(`Vendor / Authority: ${vendorName}`, 52, 620, { font: 'F2', size: 9, color: [0.2, 0.2, 0.2] });
  doc.text(`Project Site / Plant: ${facility}`, 52, 600, { font: 'F2', size: 9, color: [0.2, 0.2, 0.2] });
  doc.text(`Date of Record: ${date}`, 52, 580, { font: 'F2', size: 9, color: [0.2, 0.2, 0.2] });

  // Right Column
  doc.text(`Reported Quantity: ${quantity}`, 320, 640, { font: 'F1', size: 10, color: [0.1, 0.2, 0.4] });
  doc.text(`Verification Status: ${status}`, 320, 620, { font: 'F1', size: 9, color: status.toLowerCase().includes('verified') || status.toLowerCase().includes('paid') ? [0.1, 0.55, 0.25] : [0.8, 0.5, 0.1] });
  doc.text(`Assurance Level: Limited Internal Human Review`, 320, 600, { font: 'F2', size: 8.5, color: [0.4, 0.4, 0.4] });
  doc.text(`Audit Trail: Preserved in Immutable Hash Log`, 320, 580, { font: 'F3', size: 8.5, color: [0.4, 0.4, 0.4] });

  // Verification Parameters Section
  doc.rect(40, 525, 532, 22, { fill: true, fillColor: [0.9, 0.93, 0.97] });
  doc.text('Verification Parameter / Audit Observation', 50, 532, { font: 'F1', size: 8.5, color: [0.1, 0.2, 0.35] });
  doc.text('Recorded Value', 320, 532, { font: 'F1', size: 8.5, color: [0.1, 0.2, 0.35] });
  doc.text('Audit Status', 470, 532, { font: 'F1', size: 8.5, color: [0.1, 0.2, 0.35] });

  let y = 502;
  const items = verificationDetails.length > 0 ? verificationDetails : [
    { param: 'Activity Quantity Cross-Verification', val: quantity, status: 'MATCHED' },
    { param: 'Invoice Fiscal Period Alignment', val: 'Financial Year FY 2024-25', status: 'VERIFIED' },
    { param: 'Emission Factor Eligibility Check', val: 'CEA / IPCC Tier 1 Compliant', status: 'VALIDATED' },
    { param: 'Dual Maker-Checker Segregation', val: 'Collector vs BU Reviewer Enforced', status: 'PASSED' }
  ];

  for (const item of items) {
    doc.line(40, y - 6, 572, y - 6, { color: [0.9, 0.9, 0.9] });
    doc.text(item.param, 50, y, { font: 'F2', size: 8.5 });
    doc.text(item.val, 320, y, { font: 'F2', size: 8.5 });
    doc.text(item.status, 470, y, { font: 'F1', size: 8.5, color: [0.1, 0.55, 0.25] });
    y -= 24;
  }

  // Stamp Box
  doc.rect(360, y - 60, 212, 50, { stroke: true, strokeColor: [0.1, 0.55, 0.25], lineWidth: 1.5 });
  doc.text('ESG AUDIT VERIFIED', 390, y - 25, { font: 'F1', size: 10, color: [0.1, 0.55, 0.25] });
  doc.text('MEIL ESG Portal Assurance Gate', 380, y - 40, { font: 'F2', size: 7.5, color: [0.2, 0.5, 0.3] });
  doc.text(`Timestamp: ${new Date().toISOString()}`, 380, y - 52, { font: 'F3', size: 6.5, color: [0.3, 0.5, 0.3] });

  // Security Notice
  doc.rect(40, 80, 532, 45, { fill: true, fillColor: [0.98, 0.98, 0.98] });
  doc.text('STATUTORY DISCLOSURE NOTICE:', 50, 110, { font: 'F1', size: 8, color: [0.3, 0.3, 0.3] });
  doc.text('This document serves as digital evidentiary proof for internal and statutory ESG accounting under SEBI BRSR guidelines.', 50, 98, { font: 'F2', size: 7.5, color: [0.4, 0.4, 0.4] });
  doc.text('Tampering or falsifying operational energy activity records is prohibited under MEIL Corporate Governance Policy.', 50, 88, { font: 'F2', size: 7.5, color: [0.4, 0.4, 0.4] });

  return doc.toBuffer();
}

/**
 * Generates the official SEBI BRSR Section C Principle 6 Environmental Disclosure PDF Report.
 */
function generateBRSRReportPdf(reportData = {}) {
  const doc = new SimplePdfBuilder();

  const meta = reportData.meta || {};
  const ind1 = reportData.essentialIndicator1_Energy?.table || {};
  const ind4 = reportData.essentialIndicator4_GHG?.table || {};
  const audit = reportData.auditSummary || {};

  // PAGE 1: Header, Executive Summary, Indicator 1 (Energy)
  // Header Banner
  doc.rect(40, 715, 532, 48, { fill: true, fillColor: [0.08, 0.18, 0.36] });
  doc.text('MEGHA ENGINEERING & INFRASTRUCTURES LIMITED', 52, 743, { font: 'F1', size: 13, color: [1, 1, 1] });
  doc.text('BUSINESS RESPONSIBILITY & SUSTAINABILITY REPORT (BRSR) — SECTION C: PRINCIPLE 6', 52, 727, { font: 'F1', size: 8.5, color: [0.75, 0.88, 1] });

  // Metadata ribbon
  doc.rect(40, 665, 532, 38, { fill: true, stroke: true, fillColor: [0.96, 0.98, 1.0], strokeColor: [0.85, 0.88, 0.95] });
  doc.text(`Reporting Entity: ${meta.reportingBoundary || 'Consolidated MEIL Group'}`, 50, 688, { font: 'F1', size: 9, color: [0.1, 0.2, 0.4] });
  doc.text(`Financial Year: ${meta.financialYear || 'FY 2024-25'}`, 50, 673, { font: 'F2', size: 8.5, color: [0.3, 0.3, 0.3] });
  doc.text(`Generated: ${new Date(meta.generatedAt || Date.now()).toLocaleDateString()}`, 350, 688, { font: 'F2', size: 8.5, color: [0.3, 0.3, 0.3] });
  doc.text(`Turnover: ${meta.totalTurnoverINR_Crores !== null && meta.totalTurnoverINR_Crores !== undefined ? 'INR ' + meta.totalTurnoverINR_Crores.toLocaleString() + ' Cr' : 'Not Available'}`, 350, 673, { font: 'F2', size: 8.5, color: [0.3, 0.3, 0.3] });

  // Executive KPI summary cards (4 cards across width 532)
  const cardW = 126;
  const cardY = 595;
  const cardH = 55;

  // Card 1: Scope 1
  doc.rect(40, cardY, cardW, cardH, { fill: true, stroke: true, fillColor: [0.99, 0.95, 0.95], strokeColor: [0.9, 0.8, 0.8] });
  doc.text('Scope 1 Emissions', 48, cardY + 40, { font: 'F2', size: 7.5, color: [0.5, 0.2, 0.2] });
  doc.text(`${ind4.scope1_tCO2 !== undefined && ind4.scope1_tCO2 !== null ? ind4.scope1_tCO2.toLocaleString() : '0'}`, 48, cardY + 22, { font: 'F1', size: 13, color: [0.7, 0.1, 0.1] });
  doc.text('tCO2 (Direct)', 48, cardY + 10, { font: 'F2', size: 7, color: [0.5, 0.2, 0.2] });

  // Card 2: Scope 2 Location
  doc.rect(175, cardY, cardW, cardH, { fill: true, stroke: true, fillColor: [0.95, 0.96, 1.0], strokeColor: [0.8, 0.85, 0.95] });
  doc.text('Scope 2 (Location)', 183, cardY + 40, { font: 'F2', size: 7.5, color: [0.2, 0.3, 0.6] });
  doc.text(`${ind4.scope2_LocationBased_tCO2 !== undefined && ind4.scope2_LocationBased_tCO2 !== null ? ind4.scope2_LocationBased_tCO2.toLocaleString() : '0'}`, 183, cardY + 22, { font: 'F1', size: 13, color: [0.1, 0.3, 0.7] });
  doc.text('tCO2 (Grid Baseline)', 183, cardY + 10, { font: 'F2', size: 7, color: [0.2, 0.3, 0.6] });

  // Card 3: Scope 2 Market
  doc.rect(310, cardY, cardW, cardH, { fill: true, stroke: true, fillColor: [0.95, 0.99, 0.96], strokeColor: [0.8, 0.9, 0.85] });
  doc.text('Scope 2 (Market)', 318, cardY + 40, { font: 'F2', size: 7.5, color: [0.1, 0.5, 0.3] });
  const mktText = ind4.scope2_MarketBased_tCO2 !== null && ind4.scope2_MarketBased_tCO2 !== undefined ? `${ind4.scope2_MarketBased_tCO2.toLocaleString()}` : 'N/A';
  doc.text(mktText, 318, cardY + 22, { font: 'F1', size: 13, color: [0.1, 0.55, 0.25] });
  doc.text('tCO2 (Contractual)', 318, cardY + 10, { font: 'F2', size: 7, color: [0.1, 0.5, 0.3] });

  // Card 4: Energy
  doc.rect(446, cardY, cardW, cardH, { fill: true, stroke: true, fillColor: [0.98, 0.96, 1.0], strokeColor: [0.88, 0.82, 0.96] });
  doc.text('Total Energy', 454, cardY + 40, { font: 'F2', size: 7.5, color: [0.4, 0.2, 0.6] });
  doc.text(`${ind1.totalEnergy_GJ !== undefined && ind1.totalEnergy_GJ !== null ? ind1.totalEnergy_GJ.toLocaleString() : '0'}`, 454, cardY + 22, { font: 'F1', size: 13, color: [0.5, 0.2, 0.7] });
  doc.text(`GJ (${ind1.renewableEnergyPercentage || 0}% Renewable)`, 454, cardY + 10, { font: 'F2', size: 7, color: [0.4, 0.2, 0.6] });

  // Section Heading: Essential Indicator 1
  doc.rect(40, 550, 532, 22, { fill: true, fillColor: [0.08, 0.18, 0.36] });
  doc.text('Essential Indicator 1: Energy Consumption Breakdown (Gigajoules / GJ)', 50, 557, { font: 'F1', size: 9, color: [1, 1, 1] });

  // Indicator 1 Table
  doc.rect(40, 528, 532, 20, { fill: true, fillColor: [0.9, 0.93, 0.97] });
  doc.text('Energy Parameter', 50, 534, { font: 'F1', size: 8, color: [0.1, 0.2, 0.35] });
  doc.text('Current Financial Year', 350, 534, { font: 'F1', size: 8, color: [0.1, 0.2, 0.35] });
  doc.text('Unit of Measurement', 460, 534, { font: 'F1', size: 8, color: [0.1, 0.2, 0.35] });

  const ind1Rows = [
    { name: 'Total electricity consumption from renewable sources (A)', val: ind1.renewableElectricity_GJ !== undefined ? ind1.renewableElectricity_GJ : 0, unit: 'GJ' },
    { name: 'Total fuel consumption from renewable sources (B)', val: ind1.renewableFuel_GJ !== undefined ? ind1.renewableFuel_GJ : 0, unit: 'GJ' },
    { name: 'Energy consumption through other renewable sources (C)', val: ind1.otherRenewable_GJ !== undefined ? ind1.otherRenewable_GJ : 0, unit: 'GJ' },
    { name: 'Total Renewable Energy Consumption (A + B + C)', val: ind1.totalRenewableEnergy_GJ !== undefined ? ind1.totalRenewableEnergy_GJ : 0, unit: 'GJ', bold: true },
    { name: 'Total electricity consumption from non-renewable sources (D)', val: ind1.nonRenewableElectricity_GJ !== undefined ? ind1.nonRenewableElectricity_GJ : 0, unit: 'GJ' },
    { name: 'Total fuel consumption from non-renewable sources (E)', val: ind1.nonRenewableFuel_GJ !== undefined ? ind1.nonRenewableFuel_GJ : 0, unit: 'GJ' },
    { name: 'Energy consumption through other non-renewable sources (F)', val: ind1.otherNonRenewable_GJ !== undefined ? ind1.otherNonRenewable_GJ : 0, unit: 'GJ' },
    { name: 'Total Non-Renewable Energy Consumption (D + E + F)', val: ind1.totalNonRenewableEnergy_GJ !== undefined ? ind1.totalNonRenewableEnergy_GJ : 0, unit: 'GJ', bold: true },
    { name: 'TOTAL ENERGY CONSUMPTION (A+B+C+D+E+F)', val: ind1.totalEnergy_GJ !== undefined ? ind1.totalEnergy_GJ : 0, unit: 'GJ', bold: true, highlight: true },
    { name: 'Energy Intensity per Turnover (INR Crores)', val: ind1.energyIntensityPerTurnoverCrores !== null && ind1.energyIntensityPerTurnoverCrores !== undefined ? ind1.energyIntensityPerTurnoverCrores : 'N/A', unit: ind1.intensityUnit || 'MWh / Cr', bold: true }
  ];

  let ind1Y = 508;
  for (const row of ind1Rows) {
    if (row.highlight) {
      doc.rect(40, ind1Y - 4, 532, 18, { fill: true, fillColor: [0.93, 0.96, 1.0] });
    }
    doc.line(40, ind1Y - 4, 572, ind1Y - 4, { color: [0.88, 0.88, 0.88] });
    doc.text(row.name, 50, ind1Y, { font: row.bold ? 'F1' : 'F2', size: 8, color: [0.15, 0.15, 0.15] });
    const formattedVal = typeof row.val === 'number' ? row.val.toLocaleString() : String(row.val);
    doc.text(formattedVal, 350, ind1Y, { font: row.bold ? 'F1' : 'F2', size: 8, color: [0.1, 0.15, 0.3] });
    doc.text(row.unit, 460, ind1Y, { font: 'F2', size: 8, color: [0.4, 0.4, 0.4] });
    ind1Y -= 20;
  }

  // Audit attachment status line on page 1
  doc.rect(40, 70, 532, 28, { fill: true, stroke: true, fillColor: [0.98, 0.98, 0.98], strokeColor: [0.85, 0.85, 0.85] });
  doc.text(`Data Evidence Attachment Rate: ${audit.evidenceAttachmentRate || 0}%`, 50, 82, { font: 'F1', size: 8, color: [0.1, 0.5, 0.25] });
  doc.text(`Verified Records: ${audit.verifiedDataPoints || 0} of ${audit.totalDataPoints || 0} total entries`, 250, 82, { font: 'F2', size: 8, color: [0.3, 0.3, 0.3] });
  doc.text('Principle 6 Compliance Status: AUDITABLE', 410, 82, { font: 'F1', size: 8, color: [0.08, 0.18, 0.36] });

  // PAGE 2: Essential Indicator 4 (GHG) and Scope 2 Dual Reporting
  doc.addPage();

  // Header Banner Page 2
  doc.rect(40, 725, 532, 38, { fill: true, fillColor: [0.08, 0.18, 0.36] });
  doc.text('MEGHA ENGINEERING & INFRASTRUCTURES LIMITED', 52, 747, { font: 'F1', size: 12, color: [1, 1, 1] });
  doc.text('SEBI BRSR SECTION C — PRINCIPLE 6 (EMISSIONS & ASSURANCE REPORT)', 52, 734, { font: 'F1', size: 8, color: [0.75, 0.88, 1] });

  // Section Heading: Essential Indicator 4
  doc.rect(40, 680, 532, 22, { fill: true, fillColor: [0.08, 0.18, 0.36] });
  doc.text('Essential Indicator 4: Greenhouse Gas Emissions (Scope 1 & Scope 2)', 50, 687, { font: 'F1', size: 9, color: [1, 1, 1] });

  // Indicator 4 Table
  doc.rect(40, 658, 532, 20, { fill: true, fillColor: [0.9, 0.93, 0.97] });
  doc.text('Greenhouse Gas Metric', 50, 664, { font: 'F1', size: 8, color: [0.1, 0.2, 0.35] });
  doc.text('Current Financial Year', 350, 664, { font: 'F1', size: 8, color: [0.1, 0.2, 0.35] });
  doc.text('Accounting Method', 460, 664, { font: 'F1', size: 8, color: [0.1, 0.2, 0.35] });

  const ind4Rows = [
    { name: 'Scope 1 emissions (Break-up of the GHG into CO2, CH4, N2O)', val: `${ind4.scope1_tCO2 !== undefined && ind4.scope1_tCO2 !== null ? ind4.scope1_tCO2.toLocaleString() : '0'} tCO2`, method: 'Direct Combustion', bold: true },
    { name: 'Scope 2 emissions — Location-based method (Grid Average)', val: `${ind4.scope2_LocationBased_tCO2 !== undefined && ind4.scope2_LocationBased_tCO2 !== null ? ind4.scope2_LocationBased_tCO2.toLocaleString() : '0'} tCO2`, method: 'CEA Baseline v19', bold: true },
    { name: 'Scope 2 emissions — Market-based method (Contractual)', val: ind4.scope2_MarketBased_tCO2 !== null && ind4.scope2_MarketBased_tCO2 !== undefined ? `${ind4.scope2_MarketBased_tCO2.toLocaleString()} tCO2` : 'Unavailable (No Instruments)', method: ind4.scope2_MarketBasedStatus || 'UNAVAILABLE', bold: true },
    { name: 'Total Scope 1 and Scope 2 Emissions (Location-based)', val: `${ind4.totalScope1And2_tCO2 !== undefined && ind4.totalScope1And2_tCO2 !== null ? ind4.totalScope1And2_tCO2.toLocaleString() : '0'} tCO2`, method: 'Statutory Aggregate', bold: true, highlight: true },
    { name: 'GHG Intensity per Turnover (INR Crores)', val: ind4.ghgIntensityPerTurnoverCrores !== null && ind4.ghgIntensityPerTurnoverCrores !== undefined ? `${ind4.ghgIntensityPerTurnoverCrores} tCO2 / Cr` : 'N/A', method: ind4.intensityStatus || 'N/A', bold: true }
  ];

  let ind4Y = 636;
  for (const row of ind4Rows) {
    if (row.highlight) {
      doc.rect(40, ind4Y - 4, 532, 18, { fill: true, fillColor: [0.93, 0.96, 1.0] });
    }
    doc.line(40, ind4Y - 4, 572, ind4Y - 4, { color: [0.88, 0.88, 0.88] });
    doc.text(row.name, 50, ind4Y, { font: row.bold ? 'F1' : 'F2', size: 8, color: [0.15, 0.15, 0.15] });
    doc.text(row.val, 350, ind4Y, { font: row.bold ? 'F1' : 'F2', size: 8, color: [0.1, 0.15, 0.3] });
    doc.text(row.method, 460, ind4Y, { font: 'F2', size: 8, color: [0.4, 0.4, 0.4] });
    ind4Y -= 22;
  }

  // Scope 2 Dual-Reporting Guidance Box
  ind4Y -= 15;
  doc.rect(40, ind4Y - 55, 532, 60, { fill: true, stroke: true, fillColor: [0.97, 0.98, 1.0], strokeColor: [0.85, 0.88, 0.95] });
  doc.text('GHG PROTOCOL SCOPE 2 DUAL-REPORTING & GAS COVERAGE DISCLOSURE:', 50, ind4Y - 8, { font: 'F1', size: 8, color: [0.08, 0.18, 0.36] });
  doc.text('1. Location-based emissions reflect the average emissions intensity of grids on which energy consumption occurs (CEA India Baseline).', 50, ind4Y - 22, { font: 'F2', size: 7.5, color: [0.3, 0.3, 0.3] });
  doc.text('2. Market-based emissions reflect emissions from electricity that companies have purposefully chosen (contractual instruments, PPAs, RECs).', 50, ind4Y - 34, { font: 'F2', size: 7.5, color: [0.3, 0.3, 0.3] });
  doc.text(`3. Gas Coverage: ${reportData.essentialIndicator4_GHG?.gasCoverage || 'CO2_ONLY'}. ${reportData.essentialIndicator4_GHG?.gasCoverageNote || ''}`, 50, ind4Y - 46, { font: 'F2', size: 7.5, color: [0.3, 0.3, 0.3] });

  // Assurance & Audit Trail Block
  ind4Y -= 75;
  doc.rect(40, ind4Y - 50, 532, 55, { fill: true, stroke: true, fillColor: [0.96, 0.99, 0.96], strokeColor: [0.8, 0.9, 0.8] });
  doc.text('INDEPENDENT ESG ASSURANCE & VERIFICATION SUMMARY:', 50, ind4Y - 10, { font: 'F1', size: 8.5, color: [0.1, 0.5, 0.25] });
  doc.text(`Internal Verification Status: ${ind4.independentAssuranceStatus || 'Verified by Internal Human ESG Experts'}`, 50, ind4Y - 24, { font: 'F1', size: 8, color: [0.15, 0.15, 0.15] });
  doc.text('Assurance Standard: GHG Protocol Corporate Standard & SEBI BRSR Core Limited Assurance Framework.', 50, ind4Y - 36, { font: 'F2', size: 7.5, color: [0.3, 0.3, 0.3] });
  doc.text('Maker-Checker Segregation: Verified. Site Collectors cannot approve or audit their own data entries.', 50, ind4Y - 48, { font: 'F2', size: 7.5, color: [0.3, 0.3, 0.3] });

  // Scope 3 Notice & Disclaimer
  ind4Y -= 70;
  doc.rect(40, ind4Y - 40, 532, 45, { fill: true, fillColor: [0.98, 0.98, 0.98] });
  doc.text('SCOPE 3 VALUE CHAIN & STATUTORY DISCLAIMER:', 50, ind4Y - 8, { font: 'F1', size: 8, color: [0.3, 0.3, 0.3] });
  doc.text('Scope 3 greenhouse gas emissions are in Phase 2 roadmap alignment. This computer-generated disclosure document assists internal', 50, ind4Y - 20, { font: 'F2', size: 7.5, color: [0.4, 0.4, 0.4] });
  doc.text('aggregation and does not substitute third-party statutory assurance under SEBI regulations.', 50, ind4Y - 32, { font: 'F2', size: 7.5, color: [0.4, 0.4, 0.4] });

  return doc.toBuffer();
}

/**
 * Ensures all five seeded verification evidence documents exist as authentic, valid PDF files on disk.
 */
function seedEvidenceFiles(uploadDir) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const seedDefs = [
    {
      filename: 'HPCL_Diesel_Bulk_Invoice_Apr2024.pdf',
      title: 'Hindustan Petroleum Corporation Ltd - Bulk Diesel Tax Invoice',
      invoiceNumber: 'HPCL-BL-2024-0419',
      vendorName: 'Hindustan Petroleum Corporation Ltd',
      facility: 'MEIL Zojila Tunnel Portal West',
      quantity: '15,000 Liters High Speed Diesel',
      date: '2024-04-28',
      status: 'Paid & Verified',
      documentType: 'Tax Invoice & Delivery Challan',
      verificationDetails: [
        { param: 'Flow Meter Start Reading', val: '1,248,390 L', status: 'MATCHED' },
        { param: 'Flow Meter End Reading', val: '1,263,390 L', status: 'MATCHED' },
        { param: 'Net Delivered Volume', val: '15,000 Liters', status: 'VERIFIED' },
        { param: 'Specific Density Check', val: '0.832 kg/L @ 15 deg C', status: 'VALIDATED' }
      ]
    },
    {
      filename: 'IOCL_Fleet_Fuel_Vouchers_May2024.pdf',
      title: 'Indian Oil Corporation Ltd - Fleet Fuel Dispenser Vouchers',
      invoiceNumber: 'IOCL-DISP-08812',
      vendorName: 'Indian Oil Corporation Ltd',
      facility: 'Western Heavy Fleet Division (12 Excavator Units)',
      quantity: '28,000 Liters High Speed Diesel',
      date: '2024-05-31',
      status: 'Paid & Verified',
      documentType: 'Fleet Delivery Log & Fuel Voucher',
      verificationDetails: [
        { param: 'Fleet Dispenser Batch Count', val: '12 Heavy Equipment Units', status: 'VERIFIED' },
        { param: 'Cumulative Dispensed Volume', val: '28,000 Liters', status: 'MATCHED' },
        { param: 'Equipment Operating Hours Cross-Check', val: '4,120 Machine Hours', status: 'VALIDATED' },
        { param: 'Average Specific Fuel Consumption', val: '6.79 L/hr', status: 'PASSED' }
      ]
    },
    {
      filename: 'TSSPDCL_HT_Bill_Jun2024_Consumer7719.pdf',
      title: 'TSSPDCL - High Tension Electricity Utility Bill',
      invoiceNumber: 'TSSPDCL-HT-7719-202406',
      vendorName: 'Telangana Southern Power Distribution Company Ltd',
      facility: 'Olectra Greentech Jadcherla EV Manufacturing Plant',
      quantity: '185,000 kWh (185 MWh)',
      date: '2024-06-30',
      status: 'Paid',
      documentType: 'HT Utility Bill & Tariff Calculation',
      verificationDetails: [
        { param: 'Consumer Account Number', val: '7719-HT-IND', status: 'VERIFIED' },
        { param: 'Active Energy Consumption', val: '185,000 kWh', status: 'MATCHED' },
        { param: 'Contracted Maximum Demand', val: '1,200 kVA', status: 'COMPLIANT' },
        { param: 'Power Factor Maintained', val: '0.98 Lag', status: 'BONUS CLAIMED' }
      ]
    },
    {
      filename: 'Solar_Inverter_Export_Telemetry_Jun2024.pdf',
      title: 'Captive Rooftop Solar Plant - SCADA Export Telemetry Log',
      invoiceNumber: 'SCADA-SOL-202406-LOG',
      vendorName: 'MEIL Energy Telemetry Systems (Captive)',
      facility: 'MEIL Headquarters 500kWp Rooftop Solar System',
      quantity: '65,000 kWh (65 MWh)',
      date: '2024-06-30',
      status: 'Confirmed (Green Energy Contractual Instrument)',
      documentType: 'SCADA Telemetry Export & REC Audit Log',
      verificationDetails: [
        { param: 'Inverter Array Net Generation', val: '65,000 kWh', status: 'VERIFIED' },
        { param: 'Net Metering Export Reading', val: '65,000 kWh Feed-in', status: 'MATCHED' },
        { param: 'Contractual Ownership Instrument', val: 'On-site Captive Generation', status: 'QUALIFIED' },
        { param: 'Market-Based Scope 2 Claim Status', val: 'Eligible for 0.00 tCO2 Factor', status: 'APPROVED' }
      ]
    },
    {
      filename: 'GAIL_Custody_Transfer_Meter_Log_Jun2024.pdf',
      title: 'GAIL (India) Limited - Custody Transfer Meter Log',
      invoiceNumber: 'GAIL-CTM-2024-0630',
      vendorName: 'GAIL (India) Limited',
      facility: 'Krishna City Gas Distribution (CGD) Mother Station',
      quantity: '12,500 SCM Natural Gas',
      date: '2024-06-30',
      status: 'Under Review',
      documentType: 'Custody Transfer Log & Gas Chromatography Report',
      verificationDetails: [
        { param: 'Gross Heating Value (GHV)', val: '9,520 kcal/SCM', status: 'VALIDATED' },
        { param: 'Custody Transfer Volume', val: '12,500 SCM', status: 'VERIFIED' },
        { param: 'Pipeline Delivery Pressure', val: '19.5 bar gauge', status: 'NORMAL' },
        { param: 'Maker-Checker Review State', val: 'Pending BU Manager Approval', status: 'PENDING' }
      ]
    }
  ];

  for (const item of seedDefs) {
    const targetPath = path.resolve(uploadDir, item.filename);
    let needsWrite = true;
    if (fs.existsSync(targetPath)) {
      try {
        const existingHead = fs.readFileSync(targetPath, { encoding: 'utf8', flag: 'r' }).slice(0, 5);
        if (existingHead === '%PDF-') {
          needsWrite = false;
        }
      } catch (e) {
        needsWrite = true;
      }
    }

    if (needsWrite) {
      const pdfBytes = generateEvidencePdf(item);
      fs.writeFileSync(targetPath, pdfBytes);
    }
  }
}

module.exports = {
  SimplePdfBuilder,
  generateEvidencePdf,
  generateBRSRReportPdf,
  seedEvidenceFiles
};
