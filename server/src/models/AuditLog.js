const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  entity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity'
  },
  metricEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MetricEntry'
  },
  action: {
    type: String,
    required: true // e.g. "METRIC_SUBMITTED", "METRIC_VERIFIED", "METRIC_REJECTED", "FACTOR_UPDATED"
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedByName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
