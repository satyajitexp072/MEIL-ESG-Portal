const mongoose = require('mongoose');

const entitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Holding', 'Subsidiary', 'BusinessUnit', 'ProjectSite'],
    default: 'ProjectSite'
  },
  parentEntity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    default: null
  },
  industrySector: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },
  turnoverINR_Crores: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Turnover in INR Crores for BRSR Section C intensity calculations'
  },
  physicalOutput: {
    value: { type: Number, default: 0 },
    unit: { type: String, default: 'Units' }
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Entity', entitySchema);
