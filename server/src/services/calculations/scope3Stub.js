/**
 * Scope 3 Architectural Placeholder & Schema Readiness
 * IMPORTANT RULE: Prototype does NOT compute Scope 3 figures.
 * This module defines the extensible schema for all 15 GHG Protocol Corporate Value Chain categories.
 */

const SCOPE_3_CATEGORIES = [
  { id: 1, name: 'Purchased Goods and Services', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 2, name: 'Capital Goods', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 3, name: 'Fuel- and Energy-Related Activities (not in Scope 1 or 2)', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 4, name: 'Upstream Transportation and Distribution', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 5, name: 'Waste Generated in Operations', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 6, name: 'Business Travel', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 7, name: 'Employee Commuting', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 8, name: 'Upstream Leased Assets', type: 'Upstream', readiness: 'Schema Ready - Phase 2' },
  { id: 9, name: 'Downstream Transportation and Distribution', type: 'Downstream', readiness: 'Schema Ready - Phase 2' },
  { id: 10, name: 'Processing of Sold Products', type: 'Downstream', readiness: 'Schema Ready - Phase 2' },
  { id: 11, name: 'Use of Sold Products', type: 'Downstream', readiness: 'Schema Ready - Phase 2' },
  { id: 12, name: 'End-of-Life Treatment of Sold Products', type: 'Downstream', readiness: 'Schema Ready - Phase 2' },
  { id: 13, name: 'Downstream Leased Assets', type: 'Downstream', readiness: 'Schema Ready - Phase 2' },
  { id: 14, name: 'Franchises', type: 'Downstream', readiness: 'Schema Ready - Phase 2' },
  { id: 15, name: 'Investments', type: 'Downstream', readiness: 'Schema Ready - Phase 2' }
];

function getScope3Status() {
  return {
    status: 'ARCHITECTURAL_STUB_ONLY',
    message: 'Scope 3 greenhouse gas calculations are not implemented in this prototype. The schema is extensible and documented for future phase onboarding.',
    categories: SCOPE_3_CATEGORIES
  };
}

module.exports = { SCOPE_3_CATEGORIES, getScope3Status };
