const assert = require('assert');
const { calculateHaversineDistance, findNearbySurplus, generateDistrictRedistributionPlan } = require('./services/recommender');
const { calculateConsumptionMetrics } = require('./services/forecasting');
const { detectAnomalies } = require('./services/anomaly');
const { getSeasonalProfile, calculateSeasonalAdjustedDemand } = require('./services/seasonal');
const db = require('./database');

console.log('🧪 Running MediSync PHC Core Unit Tests...\n');

// Test 1: Haversine Distance Formula
console.log('Test 1: Haversine Distance Calculation');
// Distance between PHC Alapakkam (12.6841, 79.9830) and PHC Melamaiyur (12.7052, 79.9678)
const distAlapakkamToMelamaiyur = calculateHaversineDistance(12.6841, 79.9830, 12.7052, 79.9678);
console.log(` -> Calculated distance between Alapakkam & Melamaiyur: ${distAlapakkamToMelamaiyur} km`);
assert(distAlapakkamToMelamaiyur > 2.5 && distAlapakkamToMelamaiyur < 5.0, 'Haversine distance should be ~4.2 km');

// Test distance from a point to itself should be 0
const zeroDist = calculateHaversineDistance(12.6841, 79.9830, 12.6841, 79.9830);
assert.strictEqual(zeroDist, 0, 'Distance from point to itself must be 0');
console.log('  ✅ Haversine distance tests passed.');

// Test 2: Days-of-Stock and Consumption Metrics
console.log('\nTest 2: Days-of-Stock & Consumption Velocity');
// Check PHC Alapakkam for Paracetamol Syrup (med_01) - our seeded stockout
const alapakkamParacetamol = calculateConsumptionMetrics(db, 'phc_cpt_01', 'med_01');
console.log(` -> Alapakkam Paracetamol: current_stock=${alapakkamParacetamol.current_stock}, days_left=${alapakkamParacetamol.days_left}, status=${alapakkamParacetamol.status}`);
assert.strictEqual(alapakkamParacetamol.current_stock, 0, 'Current stock of Paracetamol at Alapakkam should be 0');
assert.strictEqual(alapakkamParacetamol.status, 'out_of_stock', 'Status should be out_of_stock');

// Check PHC Melamaiyur for Paracetamol Syrup (med_01) - our seeded surplus
const melamaiyurParacetamol = calculateConsumptionMetrics(db, 'phc_cpt_02', 'med_01');
console.log(` -> Melamaiyur Paracetamol: current_stock=${melamaiyurParacetamol.current_stock}, days_left=${melamaiyurParacetamol.days_left}, status=${melamaiyurParacetamol.status}`);
assert(melamaiyurParacetamol.current_stock >= 300, 'Current stock at Melamaiyur should be surplus >= 300');
assert(melamaiyurParacetamol.days_left > 30, 'Days of stock should be > 30');
assert(melamaiyurParacetamol.spareable_surplus > 100, 'Melamaiyur should have spareable surplus > 100 units');
console.log('  ✅ Days-of-stock calculation tests passed.');

// Test 3: Nearby Surplus Finder
console.log('\nTest 3: Nearby Stock Finder');
const surplusResults = findNearbySurplus(db, 'phc_cpt_01', 'med_01', 30);
assert(surplusResults.donors.length > 0, 'Should find at least 1 donor PHC with Paracetamol surplus');
const topDonor = surplusResults.donors[0];
console.log(` -> Top donor identified: ${topDonor.donor_phc_name} (${topDonor.distance_km} km away)`);
assert.strictEqual(topDonor.donor_phc_id, 'phc_cpt_02', 'Top nearest donor should be PHC Melamaiyur');
assert(topDonor.distance_km <= 5.0, 'Distance should be under 5 km');
console.log('  ✅ Nearby surplus finder tests passed.');

// Test 4: Seasonal Demand & Monsoon Buffer
console.log('\nTest 4: Seasonal Monsoon Multipliers');
const monsoonProfile = getSeasonalProfile(11); // November = Northeast monsoon
assert.strictEqual(monsoonProfile.code, 'NE_MONSOON', 'November should match Northeast Monsoon');
assert(monsoonProfile.multipliers['Paracetamol'] > 1.0, 'Paracetamol should have surge multiplier in monsoon');
const adjusted = calculateSeasonalAdjustedDemand('Paracetamol Syrup', 10, 11);
console.log(` -> Baseline: 10 units/day -> Monsoon Adjusted: ${adjusted.adjustedDaily} units/day (Multiplier: ${adjusted.multiplier}x)`);
assert(adjusted.adjustedDaily > 10, 'Monsoon adjusted daily rate should exceed baseline');
console.log('  ✅ Seasonal demand tests passed.');

// Test 5: District Redistribution Optimizer
console.log('\nTest 5: District Redistribution Optimizer');
const plan = generateDistrictRedistributionPlan(db, 'dist_01');
console.log(` -> Shortages detected across district: ${plan.total_shortages_detected}`);
console.log(` -> Grouped delivery runs generated: ${plan.grouped_delivery_runs.length}`);
assert(plan.grouped_delivery_runs.length > 0, 'Should generate at least 1 transfer run');
const firstRun = plan.grouped_delivery_runs[0];
console.log(` -> Sample delivery run: From ${firstRun.from_phc.name} To ${firstRun.to_phc.name} (${firstRun.distance_km} km, ${firstRun.total_items_count} items)`);
console.log('  ✅ District redistribution optimizer tests passed.');

console.log('\n======================================================');
console.log('🎉 ALL 5 TEST SUITES PASSED CLEANLY (100% SUCCESS)');
console.log('======================================================\n');
