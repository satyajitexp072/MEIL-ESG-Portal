const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileType: { type: String, default: 'application/pdf' },
  fileSize: { type: Number, default: 0 },
  documentType: {
    type: String,
    enum: [
      'PPA_CONTRACT',
      'GREEN_TARIFF_REC',
      'CAPTIVE_SOLAR_LOG',
      'CAPTIVE_SOLAR_SCADA_LOG',
      'FUEL_INVOICE',
      'ELECTRICITY_BILL',
      'METER_LOG',
      'GENERAL_INVOICE',
      'OTHER'
    ],
    default: 'OTHER'
  },
  invoiceNumber: { type: String, default: '' },
  invoiceDate: { type: Date, default: null },
  vendorName: { type: String, default: '' },
  meterReadingStart: { type: Number, default: null },
  meterReadingEnd: { type: Number, default: null },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
});

const reviewActionSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'UPDATED'],
    required: true
  },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String, required: true },
  role: { type: String, required: true },
  remarks: { type: String, default: '' },
  verifiedScope2Claim: { type: Boolean, default: false },
  claimCheckDetails: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

const metricEntrySchema = new mongoose.Schema({
  entity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true
  },
  scope: {
    type: Number,
    required: true,
    enum: [1, 2, 3]
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  subCategory: {
    type: String,
    required: true,
    trim: true
  },
  reportingPeriod: {
    financialYear: { type: String, required: true, default: 'FY 2024-25' },
    quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4', 'Full Year'], default: 'Q1' },
    month: { type: String, default: 'April' }
  },
  activityData: {
    value: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true }
  },
  emissionFactor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmissionFactor',
    required: true
  },
  calculatedEmissions: {
    co2Tonnes: { type: Number, required: true }, // Pure CO2 mass
    co2eTonnes: { type: Number, default: null }, // Null when gasCoverage is CO2_ONLY
    co2eStatus: { type: String, enum: ['NOT_QUANTIFIED_CO2_ONLY', 'FULLY_QUANTIFIED'], default: 'NOT_QUANTIFIED_CO2_ONLY' },
    gasCoverage: { type: String, enum: ['CO2_ONLY', 'CO2E_GHG_SUM'], default: 'CO2_ONLY' },
    energyMWh: { type: Number, default: 0 },
    isRenewable: { type: Boolean, default: false },
    scope2DualReporting: {
      locationBased_tCO2: { type: Number, default: 0 },
      marketBased_tCO2: { type: Number, default: 0 },
      selectedAccountingMethod: { type: String, default: 'Location-Based' },
      reportable_tCO2: { type: Number, default: 0 },
      marketClaimStatus: { type: String, default: 'N/A' } // 'VERIFIED_ZERO', 'UNVERIFIED_MISSING_EVIDENCE_PROXY', 'UNVERIFIED_PENDING_APPROVAL_PROXY', 'LOCATION_APPLIED', 'MARKET_SPECIFIC_APPLIED'
    },
    formulaApplied: { type: String, required: true },
    calculationSteps: [{ type: String }]
  },
  evidenceDocuments: [evidenceSchema],
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Under_Review', 'Verified', 'Rejected'],
    default: 'Submitted'
  },
  reviewHistory: [reviewActionSchema],
  isDemoData: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  },
  invoiceNumber: {
    type: String,
    default: '',
    trim: true
  },
  sourceRecordId: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MetricEntry', metricEntrySchema);
