const BASE_URL = 'http://localhost:5000/api';

async function runTrajectoryTests() {
  console.log('--- STARTING PHASE 5 MULTI-CAMERA TRAJECTORY ENGINE SUITE ---\n');
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

  const testPlate = 'TRJ' + Date.now().toString().slice(-6);

  // 1. Seed Multi-Camera Detections (including repeated sightings & out-of-order insertion)
  await test('Seed Multi-Camera Detections (Out-of-Order & Repeated Scans)', async () => {
    const rawEvents = [
      // Hop 1: CAM-IND-01 (10:02:15)
      {
        plateNumber: testPlate,
        confidence: 0.94,
        cameraId: 'CAM-IND-01',
        timestamp: '2026-09-30T10:02:15Z',
        direction: 'NORTHBOUND',
        speed: 52
      },
      // Hop 1 (repeat scan): CAM-IND-01 (10:02:45) - tests dwell time and consecutive collapsing
      {
        plateNumber: testPlate,
        confidence: 0.98,
        cameraId: 'CAM-IND-01',
        timestamp: '2026-09-30T10:02:45Z',
        direction: 'NORTHBOUND',
        speed: 50
      },
      // Hop 2: CAM-IND-02 (10:11:42)
      {
        plateNumber: testPlate,
        confidence: 0.95,
        cameraId: 'CAM-IND-02',
        timestamp: '2026-09-30T10:11:42Z',
        direction: 'EASTBOUND',
        speed: 58
      },
      // Hop 4 (OUT OF ORDER INSERTION!): CAM-IND-04 (10:29:10)
      {
        plateNumber: testPlate,
        confidence: 0.92,
        cameraId: 'CAM-IND-04',
        timestamp: '2026-09-30T10:29:10Z',
        direction: 'WESTBOUND',
        speed: 60
      },
      // Hop 3 (INSERTED LATER!): CAM-IND-03 (10:20:05)
      {
        plateNumber: testPlate,
        confidence: 0.96,
        cameraId: 'CAM-IND-03',
        timestamp: '2026-09-30T10:20:05Z',
        direction: 'SOUTHBOUND',
        speed: 54
      }
    ];

    for (const evt of rawEvents) {
      const res = await fetch(`${BASE_URL}/detections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evt)
      });
      if (!res.ok) throw new Error(`Failed to post detection for ${evt.cameraId}`);
    }
    console.log(`   Ingested 5 sightings across 4 cameras in non-sequential order`);
  });

  // 2. Reconstruct Trajectory via GET /api/vehicles/:plate/trajectory
  let trajectoryData = null;
  await test('Reconstruct Trajectory: Strict Chronological Order A → B → C → D', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/${testPlate}/trajectory`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Trajectory query failed');
    trajectoryData = body;

    const expectedSequence = ['CAM-IND-01', 'CAM-IND-02', 'CAM-IND-03', 'CAM-IND-04'];
    const actualSequence = body.routeSequence;

    if (JSON.stringify(actualSequence) !== JSON.stringify(expectedSequence)) {
      throw new Error(`Route mismatch! Expected ${expectedSequence.join(' → ')}, got ${actualSequence.join(' → ')}`);
    }

    console.log(`   Route reconstructed: ${body.routePathString}`);
    console.log(`   Unique cameras: ${body.uniqueCameras} | Total sightings: ${body.totalSightings} | Trajectory hops: ${body.pointCount}`);
  });

  // 3. Verify Repeated Sightings Collapsed with Dwell Time
  await test('Verify Sighting Deduplication & Dwell Time Calculation at Hop 1', async () => {
    const hop1 = trajectoryData.trajectory[0];
    if (hop1.cameraId !== 'CAM-IND-01') throw new Error('Hop 1 is not CAM-IND-01');
    if (hop1.sightingCount !== 2) throw new Error(`Expected 2 sightings at Hop 1, got ${hop1.sightingCount}`);
    if (hop1.dwellTimeSeconds !== 30) throw new Error(`Expected 30s dwell time, got ${hop1.dwellTimeSeconds}s`);
    if (hop1.confidence !== 0.98) throw new Error('Highest confidence reading was not preserved');
    console.log(`   Hop 1 verified: 2 sightings collapsed, dwellTime = ${hop1.dwellTimeSeconds}s, maxConfidence = ${hop1.confidence}`);
  });

  // 4. Verify GPS Coordinates, Transit Distances & Speeds
  await test('Verify Transit Distances and Inter-Camera Speeds', async () => {
    for (let i = 1; i < trajectoryData.trajectory.length; i++) {
      const hop = trajectoryData.trajectory[i];
      if (hop.transitDistanceMeters <= 0) {
        throw new Error(`Invalid distance for hop ${hop.stepIndex}: ${hop.transitDistanceMeters}m`);
      }
      if (hop.transitTimeSeconds <= 0) {
        throw new Error(`Invalid transit time for hop ${hop.stepIndex}: ${hop.transitTimeSeconds}s`);
      }
      if (hop.calculatedSpeedKmh <= 0) {
        throw new Error(`Invalid speed calculation for hop ${hop.stepIndex}`);
      }
      console.log(`   Hop ${hop.stepIndex} (${hop.fromCameraId} → ${hop.cameraId}): Distance ${hop.transitDistanceMeters}m | Time ${hop.transitTimeSeconds}s | Speed ${hop.calculatedSpeedKmh} km/h`);
    }

    if (trajectoryData.totalDistanceKm <= 0 || trajectoryData.averageSpeedKmh <= 0) {
      throw new Error('Overall route metrics missing or invalid');
    }
    console.log(`   Overall Journey: Distance ${trajectoryData.totalDistanceKm} km | Avg Speed ${trajectoryData.averageSpeedKmh} km/h`);
  });

  // 5. Query Non-Existent Plate
  await test('Graceful handling of unrecorded plate query', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/NONEXISTENT99/trajectory`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.pointCount !== 0) {
      throw new Error('Expected 0 points for unrecorded plate');
    }
    console.log(`   Handled gracefully: "${body.message}"`);
  });

  console.log(`=======================================================`);
  console.log(`PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) process.exit(1);
}

runTrajectoryTests();
