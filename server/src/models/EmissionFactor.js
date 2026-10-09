const mongoose = require('mongoose');

const emissionFactorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  factorCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  fuelIdentifier: {
    type: String,
    required: true,
    enum: [
      'DIESEL_HSD',
      'MOTOR_GASOLINE',
      'NATURAL_GAS_PIPELINE',
      'COAL_INDUSTRIAL_G7',
      'COAL_POWER_G11',
      'GRID_ELECTRICITY_IN',
      'SOLAR_CAPTIVE_ONSITE'
    ]
  },
  scope: {
    type: Number,
    required: true,
    enum: [1, 2, 3]
  },
  gasCoverage: {
    type: String,
    required: true,
    enum: ['CO2_ONLY', 'CO2E_GHG_SUM'],
    default: 'CO2_ONLY'
  },
  gwpBasis: {
    type: String,
    default: 'N/A (CO2 only)'
  },
  accountingMethod: {
    type: String,
    enum: ['Location-Based', 'Market-Based', 'Not-Applicable'],
    default: 'Location-Based'
  },
  contractualInstrumentRequired: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    required: true,
    trim: true // e.g. "Liquid Fuel", "Gaseous Fuel", "Purchased Electricity"
  },
  subCategory: {
    type: String,
    required: true,
    trim: true
  },
  fuelOrGridType: {
    type: String,
    required: true,
    trim: true
  },
  factorValue: {
    type: Number,
    required: true
  },
  factorUnit: {
    type: String,
    required: true // e.g. "kg CO2/liter", "tCO2/MWh", "kg CO2/SCM"
  },
  targetOutputUnit: {
    type: String,
    default: 'tCO2' // 'tCO2' for CO2_ONLY or 'tCO2e' for CO2E_GHG_SUM
  },
  unitConversionMultiplier: {
    type: Number,
    default: 1.0 // 0.001 to convert kg to metric tonnes
  },
  netCalorificValue: {
    value: { type: Number, default: 0 },
    unit: { type: String, default: '' } // e.g. "MJ/kg", "MJ/SCM", "GJ/MT"
  },
  density: {
    value: { type: Number, default: null },
    unit: { type: String, default: '' } // e.g. "kg/L"
  },
  sourceCitation: {
    type: String,
    required: true,
    trim: true // Official authority source with exact table citation
  },
  publicationYear: {
    type: Number,
    required: true
  },
  reportingPeriod: {
    type: String,
    default: ''
  },
  referenceUrl: {
    type: String,
    default: ''
  },
  isOfficial: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EmissionFactor', emissionFactorSchema);
