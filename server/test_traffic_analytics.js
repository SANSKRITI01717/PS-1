const BASE_URL = 'http://localhost:5000/api/analytics';

async function runAnalyticsTests() {
  console.log('--- STARTING PHASE 8 TRAFFIC ANALYTICS ENGINE SUITE ---\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      console.log(`⏳ Testing: ${name}...`);
      await fn();
      console.log(`✅ [PASS] ${name}\n`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}\n`);
      failed++;
    }
  }

  // 1. GET /api/analytics/traffic
  await test('GET /api/analytics/traffic - Hourly Trends & Vehicle Breakdown', async () => {
    const res = await fetch(`${BASE_URL}/traffic`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Query failed');

    if (body.totalDetections < 1 || body.uniqueVehicles < 1) {
      throw new Error('Detections or unique vehicles count missing');
    }
    if (!body.hourlyTrends || body.hourlyTrends.length !== 24) {
      throw new Error('Expected 24-hour histogram buckets');
    }

    console.log(`   Detections Analyzed: ${body.totalDetections} | Unique Plates: ${body.uniqueVehicles} | Peak Hour: ${body.peakTrafficHour}`);
    console.log(`   Vehicle Types: ${JSON.stringify(body.vehicleTypeBreakdown)}`);
  });

  // 2. GET /api/analytics/density
  await test('GET /api/analytics/density - Junction Capacity & Density Level', async () => {
    const res = await fetch(`${BASE_URL}/density`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !Array.isArray(body.densityRanking)) throw new Error('Density ranking missing');

    const topCam = body.densityRanking[0];
    if (!topCam || typeof topCam.capacityUtilizationPercentage !== 'number') {
      throw new Error('Capacity utilization calculation missing');
    }

    console.log(`   Evaluated: ${body.totalCamerasEvaluated} Junctions | Avg Utilization: ${body.averageUtilization}%`);
    console.log(`   Highest Volume Junction: ${topCam.cameraName} (${topCam.detectionCount} hits | ${topCam.densityLevel})`);
  });

  // 3. GET /api/analytics/routes
  await test('GET /api/analytics/routes - Road Segment Route Density', async () => {
    const res = await fetch(`${BASE_URL}/routes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Query failed');

    if (!body.insufficientData) {
      if (body.segments.length === 0) throw new Error('Segments array is empty');
      const s0 = body.segments[0];
      if (s0.vehicleCount <= 0 || s0.distanceMeters <= 0 || s0.averageSpeedKmh <= 0) {
        throw new Error('Segment metrics invalid');
      }
      console.log(`   Identified Corridors: ${body.totalRouteSegmentsIdentified} | Busiest: ${body.busiestCorridor}`);
      console.log(`   Top Corridor Transit: ${s0.distanceMeters}m @ ${s0.averageSpeedKmh} km/h (Volume: ${s0.vehicleCount} vehicles)`);
    } else {
      console.log(`   Result: "${body.message}"`);
    }
  });

  // 4. GET /api/analytics/speed
  await test('GET /api/analytics/speed - Transit Velocity & Violation Analysis', async () => {
    const res = await fetch(`${BASE_URL}/speed`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Query failed');

    if (!body.insufficientData) {
      if (typeof body.overallAverageSpeedKmh !== 'number' || body.overallAverageSpeedKmh <= 0) {
        throw new Error('Average speed estimation missing or invalid');
      }
      console.log(`   City Average Transit Speed: ${body.overallAverageSpeedKmh} km/h | Median: ${body.medianSpeedKmh} km/h`);
      console.log(`   Speed Range: ${body.minCorridorSpeedKmh} km/h to ${body.maxCorridorSpeedKmh} km/h | Limit: ${body.speedLimitThresholdKmh} km/h`);
    } else {
      console.log(`   Result: "${body.message}"`);
    }
  });

  // 5. GET /api/analytics/origin-destination
  await test('GET /api/analytics/origin-destination - O-D Travel Matrix', async () => {
    const res = await fetch(`${BASE_URL}/origin-destination`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Query failed');

    if (!body.insufficientData) {
      if (body.odPairs.length === 0) throw new Error('Expected O-D pairs');
      const topOD = body.odPairs[0];
      console.log(`   Total O-D Trips: ${body.totalODTripsAnalyzed} | Top Corridor: ${body.topOriginDestinationCorridor}`);
      console.log(`   Top Pair: ${topOD.originName} → ${topOD.destinationName} (${topOD.tripCount} trips, avg ${topOD.averageTripDurationMinutes} mins)`);
    } else {
      console.log(`   Result: "${body.message}"`);
    }
  });

  // 6. GET /api/analytics/congestion
  await test('GET /api/analytics/congestion - Bottleneck & Delay Estimation', async () => {
    const res = await fetch(`${BASE_URL}/congestion`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Query failed');

    console.log(`   Status: ${body.cityCongestionStatus} | Congested Corridors: ${body.totalCongestedCorridors} | Junctions: ${body.totalCongestedJunctions}`);
    if (body.congestedCorridors.length > 0) {
      const c0 = body.congestedCorridors[0];
      console.log(`   Delay Bottleneck: ${c0.corridorName} (${c0.severity} severity | Speed: ${c0.averageSpeedKmh} km/h | Est Delay: ${c0.estimatedDelayMinutes} mins)`);
    }
  });

  console.log(`=======================================================`);
  console.log(`PHASE 8 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) process.exit(1);
}

runAnalyticsTests();
