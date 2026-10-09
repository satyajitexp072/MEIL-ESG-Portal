const mongoose = require('mongoose');
require('dotenv').config();

const path = require('path');
const Entity = require('../models/Entity');
const EmissionFactor = require('../models/EmissionFactor');
const User = require('../models/User');
const MetricEntry = require('../models/MetricEntry');
const AuditLog = require('../models/AuditLog');
const { calculateEmissions } = require('../services/calculations');
const { seedEvidenceFiles } = require('../services/pdfGenerator');

const seedDatabase = async () => {
  try {
    const uploadDir = path.resolve(__dirname, '../../uploads');
    seedEvidenceFiles(uploadDir);

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meil_esg_db';
    await mongoose.connect(mongoUri);
    console.log(`[Seed Script] Connected to MongoDB: ${mongoUri}`);

    // Clear existing collections
    await Entity.deleteMany({});
    await EmissionFactor.deleteMany({});
    await User.deleteMany({});
    await MetricEntry.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('[Seed Script] Cleared old collections.');

    // 1. Seed Official Emission Factors (Official SEBI BRSR & CEA India references)
    const factorDocs = await EmissionFactor.insertMany([
      {
        name: 'Indian National Grid Baseline (CEA v19)',
        scope: 2,
        accountingMethod: 'Location-Based',
        contractualInstrumentRequired: false,
        category: 'Purchased Electricity',
        subCategory: 'National Grid Average (Location-Based)',
        fuelOrGridType: 'Grid Electricity',
        factorValue: 0.716, // tCO2e/MWh
        factorUnit: 'tCO2e/MWh',
        targetOutputUnit: 'tCO2e',
        unitConversionMultiplier: 1.0,
        sourceCitation: 'Central Electricity Authority (CEA) CO2 Baseline Database for the Indian Power Sector, User Guide Version 19.0',
        publicationYear: 2024,
        referenceUrl: 'https://cea.nic.in/cdm-co2-baseline-database/',
        isOfficial: true,
        notes: 'Official weighted average emission factor for Indian National Grid for Scope 2 location-based reporting.'
      },
      {
        name: 'High Speed Diesel (Stationary DG Sets)',
        scope: 1,
        accountingMethod: 'Not-Applicable',
        contractualInstrumentRequired: false,
        category: 'Liquid Fuel',
        subCategory: 'Diesel Generator (Stationary Combustion)',
        fuelOrGridType: 'Diesel',
        factorValue: 2.686, // kg CO2e / liter
        factorUnit: 'kg CO2e/liter',
        targetOutputUnit: 'tCO2e',
        unitConversionMultiplier: 0.001, // Convert kg to metric tonnes
        sourceCitation: 'IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol 2 Energy, Stationary Combustion',
        publicationYear: 2006,
        referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
        isOfficial: true,
        notes: 'Net calorific value 43.0 MJ/kg, density 0.843 kg/L, default emission factor 74,100 kg CO2/TJ.'
      },
      {
        name: 'High Speed Diesel (Heavy Mobile Equipment & Fleet)',
        scope: 1,
        accountingMethod: 'Not-Applicable',
        contractualInstrumentRequired: false,
        category: 'Liquid Fuel',
        subCategory: 'Dumpers, Excavators, Heavy Fleet (Mobile)',
        fuelOrGridType: 'Diesel',
        factorValue: 2.686,
        factorUnit: 'kg CO2e/liter',
        targetOutputUnit: 'tCO2e',
        unitConversionMultiplier: 0.001,
        sourceCitation: 'IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol 2 Energy, Mobile Combustion',
        publicationYear: 2006,
        referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
        isOfficial: true,
        notes: 'Standard mobile combustion factor for diesel off-road infrastructure vehicles.'
      },
      {
        name: 'Motor Gasoline / Petrol (Company Light Vehicles)',
        scope: 1,
        accountingMethod: 'Not-Applicable',
        contractualInstrumentRequired: false,
        category: 'Liquid Fuel',
        subCategory: 'Light Duty Passenger Fleet',
        fuelOrGridType: 'Petrol',
        factorValue: 2.31,
        factorUnit: 'kg CO2e/liter',
        targetOutputUnit: 'tCO2e',
        unitConversionMultiplier: 0.001,
        sourceCitation: 'IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol 2 Energy, Mobile Combustion',
        publicationYear: 2006,
        referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
        isOfficial: true,
        notes: 'Light motor vehicle fleet fuel combustion factor (NCV 44.3 MJ/kg, density 0.74 kg/L, 69,300 kg CO2/TJ).'
      },
      {
        name: 'Natural Gas / PNG / CNG (Pipelines & Heating)',
        scope: 1,
        accountingMethod: 'Not-Applicable',
        contractualInstrumentRequired: false,
        category: 'Gaseous Fuel',
        subCategory: 'Pipeline Gas & Boilers',
        fuelOrGridType: 'Natural Gas',
        factorValue: 1.98,
        factorUnit: 'kg CO2e/SCM',
        targetOutputUnit: 'tCO2e',
        unitConversionMultiplier: 0.001,
        sourceCitation: 'IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol 2 Energy, Stationary Combustion',
        publicationYear: 2006,
        referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
        isOfficial: true,
        notes: 'Natural gas pipeline factor based on 56,100 kg CO2/TJ and NCV 38.0 MJ/SCM.'
      },
      {
        name: 'Indian Indigenous Sub-Bituminous Coal',
        scope: 1,
        accountingMethod: 'Not-Applicable',
        contractualInstrumentRequired: false,
        category: 'Solid Fuel',
        subCategory: 'Industrial Boilers and Kilns',
        fuelOrGridType: 'Coal',
        factorValue: 1.85,
        factorUnit: 'tCO2e/Metric Tonne',
        targetOutputUnit: 'tCO2e',
        unitConversionMultiplier: 1.0,
        sourceCitation: 'IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol 2 Energy, Stationary Combustion',
        publicationYear: 2006,
        referenceUrl: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html',
        isOfficial: true,
        notes: 'Indian domestic thermal coal (Grade G11-G13, NCV ~ 16.7 GJ/MT, 96,100 kg CO2/TJ).'
      },
      {
        name: 'Captive Onsite Solar Generation (Market-Based)',
        scope: 2,
        accountingMethod: 'Market-Based',
        contractualInstrumentRequired: true,
        category: 'Purchased Electricity',
        subCategory: 'On-site Behind-the-Meter Captive Solar',
        fuelOrGridType: 'Solar Power',
        factorValue: 0.0,
        factorUnit: 'tCO2e/MWh',
        targetOutputUnit: 'tCO2e',
        unitConversionMultiplier: 1.0,
        sourceCitation: 'GHG Protocol Scope 2 Guidance (Market-based Method for Certified Renewable Energy)',
        publicationYear: 2015,
        referenceUrl: 'https://ghgprotocol.org/scope_2_guidance',
        isOfficial: true,
        notes: 'Documented on-site behind-the-meter captive solar photovoltaic generation. SCADA inverter export telemetry required.'
      }
    ]);
    console.log(`[Seed Script] Seeded ${factorDocs.length} Official Emission Factors.`);

    // 2. Seed MEIL Organizational Hierarchy
    // Level 1: Holding / Corporate
    const meilHolding = await Entity.create({
      name: 'Megha Engineering & Infrastructures Limited (MEIL Corporate HQ)',
      code: 'MEIL-CORP',
      type: 'Holding',
      industrySector: 'Diversified Infrastructure Conglomerate',
      location: { city: 'Hyderabad', state: 'Telangana', country: 'India' },
      turnoverINR_Crores: 2450.0,
      physicalOutput: { value: 1, unit: 'Group Operations' },
      status: 'Active'
    });

    // Level 2: Subsidiaries & Business Units
    const olectra = await Entity.create({
      name: 'Olectra Greentech Limited',
      code: 'MEIL-OLECTRA',
      type: 'Subsidiary',
      parentEntity: meilHolding._id,
      industrySector: 'Electric Mobility & Clean Transportation',
      location: { city: 'Hyderabad', state: 'Telangana', country: 'India' },
      turnoverINR_Crores: 580.0,
      physicalOutput: { value: 1200, unit: 'Electric Buses Manufactured' },
      status: 'Active'
    });

    const meghaGas = await Entity.create({
      name: 'Megha City Gas Distribution Holding',
      code: 'MEIL-MCGD',
      type: 'Subsidiary',
      parentEntity: meilHolding._id,
      industrySector: 'Hydrocarbons & City Gas Distribution',
      location: { city: 'Hyderabad', state: 'Telangana', country: 'India' },
      turnoverINR_Crores: 420.0,
      physicalOutput: { value: 45000, unit: 'PNG Household Connections' },
      status: 'Active'
    });

    const infraEPC = await Entity.create({
      name: 'MEIL Infrastructure & Tunnel EPC Division',
      code: 'MEIL-INFRA-EPC',
      type: 'BusinessUnit',
      parentEntity: meilHolding._id,
      industrySector: 'Heavy Infrastructure & Tunnelling',
      location: { city: 'Hyderabad', state: 'Telangana', country: 'India' },
      turnoverINR_Crores: 850.0,
      physicalOutput: { value: 35, unit: 'Kilometers Tunnels Excavated' },
      status: 'Active'
    });

    // Level 3: Project Sites
    const zojilaProject = await Entity.create({
      name: 'Zojila Tunnel EPC Project Site',
      code: 'MEIL-ZOJILA-SITE',
      type: 'ProjectSite',
      parentEntity: infraEPC._id,
      industrySector: 'Himalayan Tunnel Construction',
      location: { city: 'Baltal / Minamarg', state: 'Jammu & Kashmir', country: 'India' },
      turnoverINR_Crores: 120.0,
      physicalOutput: { value: 14.15, unit: 'Kilometers Tunnel' },
      status: 'Active'
    });

    const evPlantSite = await Entity.create({
      name: 'Jadcherla EV Bus Assembly Plant',
      code: 'OLECTRA-JADCHERLA',
      type: 'ProjectSite',
      parentEntity: olectra._id,
      industrySector: 'Clean Vehicle Manufacturing',
      location: { city: 'Jadcherla', state: 'Telangana', country: 'India' },
      turnoverINR_Crores: 310.0,
      physicalOutput: { value: 850, unit: 'EV Bus Chassis' },
      status: 'Active'
    });

    const gasSiteKrishna = await Entity.create({
      name: 'Krishna District City Gas Network Site',
      code: 'MCGD-KRISHNA',
      type: 'ProjectSite',
      parentEntity: meghaGas._id,
      industrySector: 'City Gas Pipeline Operations',
      location: { city: 'Vijayawada', state: 'Andhra Pradesh', country: 'India' },
      turnoverINR_Crores: 95.0,
      physicalOutput: { value: 120000, unit: 'SCM Gas Distributed' },
      status: 'Active'
    });

    console.log('[Seed Script] Seeded 7 MEIL Organizational Entities across 3 Hierarchy Levels.');

    // 3. Seed Users for Maker-Checker Demonstration
    const userList = [
      {
        name: 'Vikram Sharma (Site Engineer)',
        email: 'collector@meil.in',
        password: 'meil123',
        role: 'site_engineer',
        roleTitle: 'Site ESG Data Collector (Maker)',
        assignedEntity: zojilaProject._id
      },
      {
        name: 'Priya Iyer (BU Sustainability Manager)',
        email: 'manager@meil.in',
        password: 'meil123',
        role: 'bu_manager',
        roleTitle: 'BU ESG Reviewer (Checker Level 1)',
        assignedEntity: infraEPC._id
      },
      {
        name: 'Dr. Arun Nambiar (Lead ESG Assurance Auditor)',
        email: 'auditor@meil.in',
        password: 'meil123',
        role: 'sustainability_auditor',
        roleTitle: 'Independent Sustainability Auditor (Checker Level 2)',
        assignedEntity: meilHolding._id
      },
      {
        name: 'Chief Sustainability Officer (Admin)',
        email: 'admin@meil.in',
        password: 'meil123',
        role: 'corporate_admin',
        roleTitle: 'Chief Sustainability Officer & BRSR Lead',
        assignedEntity: meilHolding._id
      }
    ];

    const users = [];
    for (const u of userList) {
      const created = await User.create(u);
      users.push(created);
    }
    console.log(`[Seed Script] Seeded ${users.length} Users with distinct Maker-Checker roles.`);

    // 4. Seed Demonstrative Traceable ESG Metrics (Clearly Tagged with isDemoData: true)
    const dieselStationaryFactor = factorDocs.find(f => f.name.includes('Stationary DG Sets'));
    const dieselFleetFactor = factorDocs.find(f => f.name.includes('Heavy Mobile Equipment'));
    const gridFactor = factorDocs.find(f => f.name.includes('National Grid Baseline'));
    const solarFactor = factorDocs.find(f => f.name.includes('Solar'));
    const gasFactor = factorDocs.find(f => f.name.includes('Natural Gas'));

    // Entry 1: Zojila DG Sets (Scope 1) - Status: Submitted (Maker entered, pending checker)
    const calc1 = calculateEmissions(15000, 'Liters', dieselStationaryFactor);
    const metric1 = await MetricEntry.create({
      entity: zojilaProject._id,
      scope: 1,
      category: 'Stationary Combustion',
      subCategory: 'Diesel Generator (DG Set) at Portal West',
      reportingPeriod: { financialYear: 'FY 2024-25', quarter: 'Q1', month: 'April' },
      activityData: { value: 15000, unit: 'Liters' },
      emissionFactor: dieselStationaryFactor._id,
      calculatedEmissions: calc1,
      evidenceDocuments: [{
        originalName: 'HPCL_Diesel_Bulk_Invoice_Apr2024.pdf',
        fileName: 'HPCL_Diesel_Bulk_Invoice_Apr2024.pdf',
        filePath: '/uploads/HPCL_Diesel_Bulk_Invoice_Apr2024.pdf',
        fileType: 'application/pdf',
        fileSize: 245000,
        invoiceNumber: 'HPCL-BL-2024-0419',
        vendorName: 'Hindustan Petroleum Corporation Ltd'
      }],
      status: 'Submitted',
      reviewHistory: [{
        action: 'SUBMITTED',
        performedByName: 'Vikram Sharma (Site Engineer)',
        role: 'Site ESG Data Collector',
        remarks: 'Bulk diesel delivery for Portal West backup generators during grid outage.',
        timestamp: new Date('2024-05-02T10:30:00Z')
      }],
      isDemoData: true,
      notes: 'DEMO DATA: High Altitude Portal West genset operation logs verified against fuel dispenser meter.'
    });

    // Entry 2: Western Freight Dumpers (Scope 1) - Status: Verified by BU Manager
    const calc2 = calculateEmissions(28000, 'Liters', dieselFleetFactor);
    const metric2 = await MetricEntry.create({
      entity: zojilaProject._id,
      scope: 1,
      category: 'Mobile Combustion',
      subCategory: 'Heavy Excavator & Tunnel Dumper Fleet',
      reportingPeriod: { financialYear: 'FY 2024-25', quarter: 'Q1', month: 'May' },
      activityData: { value: 28000, unit: 'Liters' },
      emissionFactor: dieselFleetFactor._id,
      calculatedEmissions: calc2,
      evidenceDocuments: [{
        originalName: 'IOCL_Fleet_Fuel_Vouchers_May2024.pdf',
        fileName: 'IOCL_Fleet_Fuel_Vouchers_May2024.pdf',
        filePath: '/uploads/IOCL_Fleet_Fuel_Vouchers_May2024.pdf',
        fileType: 'application/pdf',
        fileSize: 412000,
        invoiceNumber: 'IOCL-DISP-08812',
        vendorName: 'Indian Oil Corporation Ltd'
      }],
      status: 'Verified',
      reviewHistory: [
        {
          action: 'SUBMITTED',
          performedByName: 'Vikram Sharma (Site Engineer)',
          role: 'Site ESG Data Collector',
          remarks: 'Submitted fuel consumption logs for 12 heavy excavators.',
          timestamp: new Date('2024-06-03T09:15:00Z')
        },
        {
          action: 'VERIFIED',
          performedByName: 'Priya Iyer (BU Sustainability Manager)',
          role: 'BU ESG Reviewer',
          remarks: 'Audited log sheets against equipment hour meter telemetry. Quantities cross-verified with IOCL invoices.',
          timestamp: new Date('2024-06-05T14:40:00Z')
        }
      ],
      isDemoData: true,
      notes: 'DEMO DATA: Heavy equipment fleet operational log.'
    });

    // Entry 3: Jadcherla EV Plant Grid Power (Scope 2) - Status: Verified by Auditor
    const calc3 = calculateEmissions(185000, 'kWh', gridFactor);
    const metric3 = await MetricEntry.create({
      entity: evPlantSite._id,
      scope: 2,
      category: 'Purchased Electricity',
      subCategory: 'TSSPDCL Industrial HT Electricity Tariff',
      reportingPeriod: { financialYear: 'FY 2024-25', quarter: 'Q1', month: 'June' },
      activityData: { value: 185000, unit: 'kWh' },
      emissionFactor: gridFactor._id,
      calculatedEmissions: calc3,
      evidenceDocuments: [{
        originalName: 'TSSPDCL_HT_Bill_Jun2024_Consumer7719.pdf',
        fileName: 'TSSPDCL_HT_Bill_Jun2024_Consumer7719.pdf',
        filePath: '/uploads/TSSPDCL_HT_Bill_Jun2024_Consumer7719.pdf',
        fileType: 'application/pdf',
        fileSize: 320000,
        invoiceNumber: 'TSSPDCL-HT-06-2024-998',
        vendorName: 'Telangana State Southern Power Distribution Co Ltd'
      }],
      status: 'Verified',
      reviewHistory: [
        {
          action: 'SUBMITTED',
          performedByName: 'Olectra Plant Electrical Lead',
          role: 'Site ESG Data Collector',
          remarks: 'HT electricity bill for battery module charging and welding lines.',
          timestamp: new Date('2024-07-04T11:00:00Z')
        },
        {
          action: 'VERIFIED',
          performedByName: 'Dr. Arun Nambiar (Lead ESG Assurance Auditor)',
          role: 'Independent Sustainability Auditor',
          remarks: 'Verified against TSSPDCL payment receipt and SCADA sub-metering breakdown. Applied CEA v19 grid factor 0.716 tCO2/MWh.',
          timestamp: new Date('2024-07-06T16:20:00Z')
        }
      ],
      isDemoData: true,
      notes: 'DEMO DATA: HT industrial power supply for EV chassis fabrication.'
    });

    // Entry 4: MEIL Corporate Captive Rooftop Solar (Scope 2 Renewable) - Status: Verified
    const calc4 = calculateEmissions(65000, 'kWh', solarFactor);
    const metric4 = await MetricEntry.create({
      entity: meilHolding._id,
      scope: 2,
      category: 'Purchased Electricity',
      subCategory: 'Captive Rooftop Solar PV Generation (Zero Scope 2)',
      reportingPeriod: { financialYear: 'FY 2024-25', quarter: 'Q1', month: 'June' },
      activityData: { value: 65000, unit: 'kWh' },
      emissionFactor: solarFactor._id,
      calculatedEmissions: calc4,
      evidenceDocuments: [{
        originalName: 'Solar_Inverter_Export_Telemetry_Jun2024.pdf',
        fileName: 'Solar_Inverter_Export_Telemetry_Jun2024.pdf',
        filePath: '/uploads/Solar_Inverter_Export_Telemetry_Jun2024.pdf',
        fileType: 'application/pdf',
        fileSize: 180000,
        invoiceNumber: 'SOLAR-LOG-2024-06',
        vendorName: 'Schneider Solar SCADA'
      }],
      status: 'Verified',
      reviewHistory: [
        {
          action: 'SUBMITTED',
          performedByName: 'HQ Facilities Manager',
          role: 'Site ESG Data Collector',
          remarks: '65 MWh clean solar generation reported for corporate headquarters building.',
          timestamp: new Date('2024-07-02T10:00:00Z')
        },
        {
          action: 'VERIFIED',
          performedByName: 'Dr. Arun Nambiar (Lead ESG Assurance Auditor)',
          role: 'Independent Sustainability Auditor',
          remarks: 'Confirmed zero emission factor under GHG Protocol Scope 2 Guidance (Market-based). Counted in BRSR Indicator 1 Renewable Energy.',
          timestamp: new Date('2024-07-05T11:30:00Z')
        }
      ],
      isDemoData: true,
      notes: 'DEMO DATA: Corporate HQ 500kWp rooftop solar array output.'
    });

    // Entry 5: Megha Gas Pipeline Compressor Natural Gas (Scope 1) - Status: Under_Review
    const calc5 = calculateEmissions(12500, 'SCM', gasFactor);
    const metric5 = await MetricEntry.create({
      entity: gasSiteKrishna._id,
      scope: 1,
      category: 'Gaseous Fuel',
      subCategory: 'City Gas Mother Station Gas Engine Compressor',
      reportingPeriod: { financialYear: 'FY 2024-25', quarter: 'Q1', month: 'June' },
      activityData: { value: 12500, unit: 'SCM' },
      emissionFactor: gasFactor._id,
      calculatedEmissions: calc5,
      evidenceDocuments: [{
        originalName: 'GAIL_Custody_Transfer_Meter_Log_Jun2024.pdf',
        fileName: 'GAIL_Custody_Transfer_Meter_Log_Jun2024.pdf',
        filePath: '/uploads/GAIL_Custody_Transfer_Meter_Log_Jun2024.pdf',
        fileType: 'application/pdf',
        fileSize: 290000,
        invoiceNumber: 'GAIL-CTM-2024-0611',
        vendorName: 'GAIL (India) Limited'
      }],
      status: 'Under_Review',
      reviewHistory: [
        {
          action: 'SUBMITTED',
          performedByName: 'Krishna CGD Station Lead',
          role: 'Site ESG Data Collector',
          remarks: 'Natural gas consumed for operating high-pressure CNG booster compressors.',
          timestamp: new Date('2024-07-01T15:00:00Z')
        },
        {
          action: 'UNDER_REVIEW',
          performedByName: 'Priya Iyer (BU Sustainability Manager)',
          role: 'BU ESG Reviewer',
          remarks: 'Reviewing calorific value adjustment on GAIL custody transfer meter certificate. Awaiting signed calibration sheet.',
          timestamp: new Date('2024-07-03T16:00:00Z')
        }
      ],
      isDemoData: true,
      notes: 'DEMO DATA: CGD compression station fuel consumption.'
    });

    console.log('[Seed Script] Seeded 5 Demonstrative Traceable ESG Metric Entries.');

    // Seed sample audit logs
    await AuditLog.insertMany([
      {
        entity: zojilaProject._id,
        metricEntry: metric1._id,
        action: 'METRIC_SUBMITTED',
        performedByName: 'Vikram Sharma (Site Engineer)',
        role: 'site_engineer',
        details: { fuel: 'Diesel', qty: '15,000 Liters', tCO2e: calc1.co2eTonnes },
        timestamp: new Date('2024-05-02T10:30:00Z')
      },
      {
        entity: zojilaProject._id,
        metricEntry: metric2._id,
        action: 'METRIC_VERIFIED',
        performedByName: 'Priya Iyer (BU Sustainability Manager)',
        role: 'bu_manager',
        details: { fuel: 'Diesel Fleet', qty: '28,000 Liters', tCO2e: calc2.co2eTonnes },
        timestamp: new Date('2024-06-05T14:40:00Z')
      },
      {
        entity: evPlantSite._id,
        metricEntry: metric3._id,
        action: 'METRIC_VERIFIED',
        performedByName: 'Dr. Arun Nambiar (Lead ESG Assurance Auditor)',
        role: 'sustainability_auditor',
        details: { type: 'Grid Electricity', qty: '185,000 kWh', tCO2e: calc3.co2eTonnes, factor: 'CEA v19' },
        timestamp: new Date('2024-07-06T16:20:00Z')
      }
    ]);
    console.log('[Seed Script] Seeded sample audit logs.');

    console.log('\n======================================================');
    console.log(' SEEDING COMPLETE FOR MEIL-ESG-PORTAL');
    console.log(' All records clearly tagged with isDemoData: true');
    console.log(' Real CEA v19 and IPCC 2006 factors populated.');
    console.log(' Demo credentials:');
    console.log(' - Collector: collector@meil.in / meil123');
    console.log(' - Reviewer:  manager@meil.in / meil123');
    console.log(' - Auditor:   auditor@meil.in / meil123');
    console.log(' - Admin:     admin@meil.in / meil123');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Script Error]:', error);
    process.exit(1);
  }
};

seedDatabase();
