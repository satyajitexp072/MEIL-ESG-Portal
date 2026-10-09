const { calculateScope1 } = require('./scope1');
const { calculateScope2 } = require('./scope2');
const { getScope3Status, SCOPE_3_CATEGORIES } = require('./scope3Stub');

function calculateEmissions(activityValue, activityUnit, factorDoc, context = {}) {
  if (!factorDoc) {
    throw new Error('Emission factor reference document is required for calculation.');
  }

  const scope = Number(factorDoc.scope);

  if (scope === 1) {
    return calculateScope1(activityValue, activityUnit, factorDoc);
  } else if (scope === 2) {
    return calculateScope2(activityValue, activityUnit, factorDoc, context);
  } else if (scope === 3) {
    throw new Error('Scope 3 calculations are not enabled in this prototype (Architectural placeholder only).');
  } else {
    throw new Error(`Unsupported GHG scope: ${scope}`);
  }
}

module.exports = {
  calculateEmissions,
  calculateScope1,
  calculateScope2,
  getScope3Status,
  SCOPE_3_CATEGORIES
};
