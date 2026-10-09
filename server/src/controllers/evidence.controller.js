const path = require('path');
const fs = require('fs');
const MetricEntry = require('../models/MetricEntry');
const JuryDemoMetric = require('../models/JuryDemoMetric');

const uploadDir = path.resolve(__dirname, '../../uploads');

exports.downloadEvidence = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, message: 'Filename parameter is required.' });
    }

    // Path traversal mitigation
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Security Alert: Path traversal sequence detected.'
      });
    }

    // Locate the metric entry that owns this evidence file (operational or jury demo)
    let metric = await MetricEntry.findOne({ 'evidenceDocuments.fileName': safeFilename });
    let isDemoEntry = false;
    if (!metric) {
      metric = await JuryDemoMetric.findOne({ 'evidenceDocuments.fileName': safeFilename });
      if (metric) isDemoEntry = true;
    }

    if (!metric) {
      return res.status(404).json({
        success: false,
        message: 'Evidence file record not found or not associated with any metric entry.'
      });
    }

    // Entity-level access control: Site Engineers can ONLY access operational evidence for their assigned entity
    if (req.user.role === 'site_engineer' && !isDemoEntry) {
      const userAssignedEntityStr = req.user.assignedEntity ? req.user.assignedEntity.toString() : '';
      const metricEntityStr = metric.entity ? (metric.entity._id ? metric.entity._id.toString() : metric.entity.toString()) : '';

      if (!userAssignedEntityStr || metricEntityStr !== userAssignedEntityStr) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to view or download evidence files belonging to other site entities.'
        });
      }
    }

    // Verify absolute file path stays strictly within the uploads directory
    const fullPath = path.resolve(uploadDir, safeFilename);
    if (!fullPath.startsWith(uploadDir)) {
      return res.status(400).json({
        success: false,
        message: 'Access Denied: Invalid file path.'
      });
    }

    // Auto-heal seed evidence files if missing
    if (!fs.existsSync(fullPath)) {
      const { seedEvidenceFiles } = require('../services/pdfGenerator');
      seedEvidenceFiles(uploadDir);
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'Evidence file not found on disk storage.'
      });
    }

    // Set correct PDF and document response headers
    const docMeta = metric.evidenceDocuments?.find(d => d.fileName === safeFilename);
    const downloadName = (docMeta && docMeta.originalName) ? docMeta.originalName : safeFilename;
    const mimeType = (docMeta && docMeta.fileType) ? docMeta.fileType : (safeFilename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${downloadName.replace(/["\r\n]/g, '_')}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    // Send file securely
    res.sendFile(fullPath);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
