const mongoose = require('mongoose');

const disclosedMetricItemSchema = new mongoose.Schema({
  metricName: { type: String, required: true },
  metricCategory: {
    type: String,
    enum: ['GHG_EMISSIONS', 'ENERGY_CONSUMPTION', 'INTENSITY'],
    required: true
  },
  reportedValue: { type: Number, required: true },
  reportedUnit: { type: String, required: true },
  scope: { type: Number, enum: [1, 2, null], default: null },
  isRenewable: { type: Boolean, default: false },
  originalLabelInReport: { type: String, required: true }
}, { _id: false });

const publishedDisclosureSchema = new mongoose.Schema({
  reportingEntity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true
  },
  reportingEntityName: {
    type: String,
    required: true,
    default: 'Olectra Greentech Limited'
  },
  entityCode: {
    type: String,
    required: true,
    default: 'MEIL-OLECTRA'
  },
  attributedToMeilGroup: {
    type: Boolean,
    default: false,
    description: 'Never attribute subsidiary public disclosures to MEIL parent or consolidated group'
  },
  financialYear: {
    type: String,
    required: true,
    enum: ['FY 2024-25', 'FY 2023-24']
  },
  reportTitle: {
    type: String,
    required: true,
    default: 'Olectra Greentech Limited Annual Report 2024-25 (BRSR Section C)'
  },
  sourceUrl: {
    type: String,
    required: true,
    default: 'https://olectra.com/wp-content/uploads/AR-2024-25.pdf'
  },
  sourcePageTable: {
    type: String,
    required: true,
    default: 'Business Responsibility and Sustainability Reporting (BRSR), Section C: Principle 6 (Essential Indicators 1 & 4)'
  },
  provenanceStatus: {
    type: String,
    enum: ['COMPANY_REPORTED_PUBLISHED_DISCLOSURE', 'INDEPENDENTLY_ASSURED_EXTERNAL'],
    default: 'COMPANY_REPORTED_PUBLISHED_DISCLOSURE'
  },
  isIndependentlyAudited: {
    type: Boolean,
    default: false
  },
  auditAssuranceNotes: {
    type: String,
    default: 'Company-reported public statutory disclosure from published Annual Report. Not independently audited by MEIL internal platform checkers.'
  },
  importTimestamp: {
    type: Date,
    default: Date.now
  },
  // Structured summary reflecting official BRSR indicators
  ghgEmissions: {
    scope1_tCO2e: { type: Number, required: true },
    scope2_tCO2e: { type: Number, required: true },
    scope1And2_Intensity_per_Turnover: {
      value: { type: Number, required: true },
      unit: { type: String, default: 'tCO2e/INR lakh' }
    }
  },
  energyConsumption_GJ: {
    totalEnergy_GJ: { type: Number, required: true },
    nonRenewableElectricity_GJ: { type: Number, required: true },
    nonRenewableFuel_GJ: { type: Number, required: true },
    otherNonRenewableEnergy_GJ: { type: Number, required: true },
    renewableElectricity_GJ: { type: Number, default: 0 },
    renewableFuel_GJ: { type: Number, default: 0 },
    otherRenewableEnergy_GJ: { type: Number, default: 0 }
  },
  // Individual metric items preserving exact reported precision & unit
  reportedMetrics: [disclosedMetricItemSchema],
  notes: {
    type: String,
    default: 'Official annual statutory disclosure figures published by Olectra Greentech Limited.'
  }
}, {
  timestamps: true
});

// Unique index per entity and financial year
publishedDisclosureSchema.index({ reportingEntity: 1, financialYear: 1 }, { unique: true });

module.exports = mongoose.model('PublishedDisclosure', publishedDisclosureSchema);
