const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function checkDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meil_esg_db';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const indexes = await db.collection('emissionfactors').indexes();
  console.log('=== EMISSION FACTORS INDEXES ===');
  console.log(JSON.stringify(indexes, null, 2));

  const factors = await db.collection('emissionfactors').find({}).toArray();
  console.log('\n=== TOTAL EMISSION FACTORS:', factors.length, '===');
  factors.forEach(f => {
    console.log(`ID: ${f._id} | Code: ${f.factorCode || 'UNSET'} | FuelId: ${f.fuelIdentifier || 'UNSET'} | Name: ${f.fuelOrGridType || f.name} | SubCat: ${f.subCategory} | Val: ${f.factorValue} ${f.factorUnit} | Gas: ${f.gasCoverage}`);
  });

  const metrics = await db.collection('metricentries').find({}).toArray();
  console.log('\n=== TOTAL METRIC ENTRIES:', metrics.length, '===');
  const factorIds = new Set(factors.map(f => f._id.toString()));
  let orphanedCount = 0;
  metrics.forEach(m => {
    const factorRefStr = m.emissionFactor ? m.emissionFactor.toString() : 'NONE';
    const isOrphaned = !factorIds.has(factorRefStr);
    if (isOrphaned) orphanedCount++;
    console.log(`Metric ID: ${m._id} | Scope: ${m.scope} | Factor: ${factorRefStr} (Valid: ${!isOrphaned}) | co2: ${m.calculatedEmissions?.co2Tonnes} | co2e: ${m.calculatedEmissions?.co2eTonnes} | Status: ${m.status}`);
  });
  console.log('\nOrphaned Metric References:', orphanedCount);

  await mongoose.disconnect();
}

checkDb().catch(console.error);
