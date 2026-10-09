const Entity = require('../models/Entity');
const PublishedDisclosure = require('../models/PublishedDisclosure');

const SOURCE_URL = 'https://olectra.com/wp-content/uploads/AR-2024-25.pdf';
const REPORT_TITLE = 'Olectra Greentech Limited Annual Report 2024-25 (BRSR Section C)';
const SOURCE_PAGE_TABLE = 'BRSR Section C, Principle 6 (Essential Indicators 1 & 4)';

/**
 * Public annual disclosure dataset for Olectra Greentech Limited
 * as reported in the official FY 2024-25 Annual Report / BRSR.
 */
const OLECTRA_DISCLOSURE_DATA = [
  {
    financialYear: 'FY 2024-25',
    ghgEmissions: {
      scope1_tCO2e: 17.98,
      scope2_tCO2e: 3595.00,
      scope1And2_Intensity_per_Turnover: {
        value: 0.02,
        unit: 'tCO2e/INR lakh'
      }
    },
    energyConsumption_GJ: {
      totalEnergy_GJ: 25690.7,
      nonRenewableElectricity_GJ: 17211.3,
      nonRenewableFuel_GJ: 6649.7,
      otherNonRenewableEnergy_GJ: 1829.8,
      renewableElectricity_GJ: 0,
      renewableFuel_GJ: 0,
      otherRenewableEnergy_GJ: 0
    },
    reportedMetrics: [
      {
        metricName: 'Scope 1 emissions',
        metricCategory: 'GHG_EMISSIONS',
        reportedValue: 17.98,
        reportedUnit: 'tCO2e',
        scope: 1,
        isRenewable: false,
        originalLabelInReport: 'Scope 1 emissions (Metric tonnes of CO2 equivalent)'
      },
      {
        metricName: 'Scope 2 emissions',
        metricCategory: 'GHG_EMISSIONS',
        reportedValue: 3595.00,
        reportedUnit: 'tCO2e',
        scope: 2,
        isRenewable: false,
        originalLabelInReport: 'Scope 2 emissions (Metric tonnes of CO2 equivalent)'
      },
      {
        metricName: 'Scope 1 + Scope 2 emissions intensity per turnover',
        metricCategory: 'INTENSITY',
        reportedValue: 0.02,
        reportedUnit: 'tCO2e/INR lakh',
        scope: null,
        isRenewable: false,
        originalLabelInReport: 'Total Scope 1 and Scope 2 emissions per rupee of turnover (tCO2e/INR lakh)'
      },
      {
        metricName: 'Total energy consumption',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 25690.7,
        reportedUnit: 'GJ',
        scope: null,
        isRenewable: false,
        originalLabelInReport: 'Total energy consumed (GJ)'
      },
      {
        metricName: 'Non-renewable electricity',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 17211.3,
        reportedUnit: 'GJ',
        scope: 2,
        isRenewable: false,
        originalLabelInReport: 'Electricity consumption from non-renewable sources (GJ)'
      },
      {
        metricName: 'Non-renewable fuel',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 6649.7,
        reportedUnit: 'GJ',
        scope: 1,
        isRenewable: false,
        originalLabelInReport: 'Fuel consumption from non-renewable sources (GJ)'
      },
      {
        metricName: 'Other non-renewable energy',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 1829.8,
        reportedUnit: 'GJ',
        scope: null,
        isRenewable: false,
        originalLabelInReport: 'Other non-renewable energy consumption (GJ)'
      },
      {
        metricName: 'Renewable electricity',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 0,
        reportedUnit: 'GJ',
        scope: 2,
        isRenewable: true,
        originalLabelInReport: 'Electricity consumption from renewable sources (GJ)'
      },
      {
        metricName: 'Renewable fuel',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 0,
        reportedUnit: 'GJ',
        scope: 1,
        isRenewable: true,
        originalLabelInReport: 'Fuel consumption from renewable sources (GJ)'
      },
      {
        metricName: 'Other renewable energy',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 0,
        reportedUnit: 'GJ',
        scope: null,
        isRenewable: true,
        originalLabelInReport: 'Other renewable energy consumption (GJ)'
      }
    ],
    notes: 'Figures extracted directly from Olectra Greentech Limited Annual Report / BRSR 2024-25. Stored as company-reported statutory disclosure without alteration.'
  },
  {
    financialYear: 'FY 2023-24',
    ghgEmissions: {
      scope1_tCO2e: 46.98,
      scope2_tCO2e: 6659,
      scope1And2_Intensity_per_Turnover: {
        value: 0.06,
        unit: 'tCO2e/INR lakh'
      }
    },
    energyConsumption_GJ: {
      totalEnergy_GJ: 19153,
      nonRenewableElectricity_GJ: 18309,
      nonRenewableFuel_GJ: 675,
      otherNonRenewableEnergy_GJ: 169,
      renewableElectricity_GJ: 0,
      renewableFuel_GJ: 0,
      otherRenewableEnergy_GJ: 0
    },
    reportedMetrics: [
      {
        metricName: 'Scope 1 emissions',
        metricCategory: 'GHG_EMISSIONS',
        reportedValue: 46.98,
        reportedUnit: 'tCO2e',
        scope: 1,
        isRenewable: false,
        originalLabelInReport: 'Scope 1 emissions (Metric tonnes of CO2 equivalent)'
      },
      {
        metricName: 'Scope 2 emissions',
        metricCategory: 'GHG_EMISSIONS',
        reportedValue: 6659,
        reportedUnit: 'tCO2e',
        scope: 2,
        isRenewable: false,
        originalLabelInReport: 'Scope 2 emissions (Metric tonnes of CO2 equivalent)'
      },
      {
        metricName: 'Scope 1 + Scope 2 emissions intensity per turnover',
        metricCategory: 'INTENSITY',
        reportedValue: 0.06,
        reportedUnit: 'tCO2e/INR lakh',
        scope: null,
        isRenewable: false,
        originalLabelInReport: 'Total Scope 1 and Scope 2 emissions per rupee of turnover (tCO2e/INR lakh)'
      },
      {
        metricName: 'Total energy consumption',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 19153,
        reportedUnit: 'GJ',
        scope: null,
        isRenewable: false,
        originalLabelInReport: 'Total energy consumed (GJ)'
      },
      {
        metricName: 'Non-renewable electricity',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 18309,
        reportedUnit: 'GJ',
        scope: 2,
        isRenewable: false,
        originalLabelInReport: 'Electricity consumption from non-renewable sources (GJ)'
      },
      {
        metricName: 'Non-renewable fuel',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 675,
        reportedUnit: 'GJ',
        scope: 1,
        isRenewable: false,
        originalLabelInReport: 'Fuel consumption from non-renewable sources (GJ)'
      },
      {
        metricName: 'Other non-renewable energy',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 169,
        reportedUnit: 'GJ',
        scope: null,
        isRenewable: false,
        originalLabelInReport: 'Other non-renewable energy consumption (GJ)'
      },
      {
        metricName: 'Renewable electricity',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 0,
        reportedUnit: 'GJ',
        scope: 2,
        isRenewable: true,
        originalLabelInReport: 'Electricity consumption from renewable sources (GJ)'
      },
      {
        metricName: 'Renewable fuel',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 0,
        reportedUnit: 'GJ',
        scope: 1,
        isRenewable: true,
        originalLabelInReport: 'Fuel consumption from renewable sources (GJ)'
      },
      {
        metricName: 'Other renewable energy',
        metricCategory: 'ENERGY_CONSUMPTION',
        reportedValue: 0,
        reportedUnit: 'GJ',
        scope: null,
        isRenewable: true,
        originalLabelInReport: 'Other renewable energy consumption (GJ)'
      }
    ],
    notes: 'Prior year comparative figures extracted from Olectra Greentech Limited Annual Report / BRSR 2024-25.'
  }
];

/**
 * Imports or updates official published annual disclosure records for Olectra Greentech Limited.
 * Non-destructive: Existing operational metrics, entities, and seed records remain untouched.
 */
async function importOlectraDisclosures() {
  let olectra = await Entity.findOne({
    $or: [{ code: 'MEIL-OLECTRA' }, { name: 'Olectra Greentech Limited' }]
  });

  if (!olectra) {
    // If entity doesn't exist, create it cleanly
    olectra = await Entity.create({
      name: 'Olectra Greentech Limited',
      code: 'MEIL-OLECTRA',
      type: 'Subsidiary',
      industrySector: 'Electric Mobility & Clean Transportation',
      location: { city: 'Hyderabad', state: 'Telangana', country: 'India' },
      turnoverINR_Crores: 580.0,
      physicalOutput: { value: 1200, unit: 'Electric Buses Manufactured' },
      status: 'Active'
    });
  }

  const results = [];
  const now = new Date();

  for (const entry of OLECTRA_DISCLOSURE_DATA) {
    const docData = {
      reportingEntity: olectra._id,
      reportingEntityName: olectra.name,
      entityCode: olectra.code,
      attributedToMeilGroup: false, // Strict: Never attribute subsidiary public disclosure to MEIL group
      financialYear: entry.financialYear,
      reportTitle: REPORT_TITLE,
      sourceUrl: SOURCE_URL,
      sourcePageTable: SOURCE_PAGE_TABLE,
      provenanceStatus: 'COMPANY_REPORTED_PUBLISHED_DISCLOSURE',
      isIndependentlyAudited: false, // Strict: Source does not establish independent platform audit
      auditAssuranceNotes: 'Company-reported public statutory disclosure from published Annual Report. Not independently audited by MEIL internal platform checkers.',
      importTimestamp: now,
      ghgEmissions: entry.ghgEmissions,
      energyConsumption_GJ: entry.energyConsumption_GJ,
      reportedMetrics: entry.reportedMetrics,
      notes: entry.notes
    };

    const updatedDoc = await PublishedDisclosure.findOneAndUpdate(
      {
        reportingEntity: olectra._id,
        financialYear: entry.financialYear
      },
      docData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    results.push(updatedDoc);
  }

  return {
    success: true,
    message: `Successfully imported ${results.length} published annual disclosure records for ${olectra.name}.`,
    entity: {
      id: olectra._id,
      name: olectra.name,
      code: olectra.code
    },
    disclosures: results
  };
}

module.exports = {
  importOlectraDisclosures,
  OLECTRA_DISCLOSURE_DATA,
  SOURCE_URL,
  REPORT_TITLE,
  SOURCE_PAGE_TABLE
};
