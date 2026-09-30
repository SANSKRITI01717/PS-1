const BASE_URL = 'http://localhost:5000/api';

async function runGISTests() {
  console.log('--- STARTING PHASE 6 GIS TRAJECTORY VISUALIZATION VERIFICATION ---\n');
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

  // 1. Verify Trajectory with At Least 3 Cameras for MP04AB1234
  await test('Verify Trajectory Rendering Data with 4 Cameras (MP04AB1234)', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/MP04AB1234/trajectory`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();

    if (!body.success) throw new Error('Failed to retrieve trajectory');
    if (body.pointCount < 3) {
      throw new Error(`Expected at least 3 cameras in trajectory, found ${body.pointCount}`);
    }

    console.log(`   Camera Count: ${body.pointCount} (>= 3 cameras requirement satisfied)`);
    console.log(`   Route Sequence: ${body.routeSequence.join(' → ')}`);

    // Verify each coordinate
    body.trajectory.forEach((hop, idx) => {
      if (typeof hop.latitude !== 'number' || typeof hop.longitude !== 'number') {
        throw new Error(`Hop ${idx + 1} has invalid coordinates`);
      }
      if (hop.latitude < 20 || hop.latitude > 35 || hop.longitude < 70 || hop.longitude > 85) {
        throw new Error(`Hop ${idx + 1} coordinates outside valid GPS bounds: ${hop.latitude}, ${hop.longitude}`);
      }
    });
    console.log(`   All ${body.pointCount} GPS coordinates validated for Leaflet rendering`);
  });

  // 2. Verify Polyline Coordinates Continuum
  await test('Verify Polyline Coordinates Continuity & Distance Matrix', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/MP04AB1234/trajectory`);
    const body = await res.json();

    const polyline = body.trajectory.map(h => [h.latitude, h.longitude]);
    if (polyline.length !== 4) throw new Error(`Expected 4 coordinates in polyline, got ${polyline.length}`);

    // Verify distance between all adjacent points is positive
    for (let i = 1; i < body.trajectory.length; i++) {
      const seg = body.trajectory[i];
      if (seg.transitDistanceMeters <= 500) {
        throw new Error(`Suspiciously small or zero distance: ${seg.transitDistanceMeters}m`);
      }
      console.log(`   Polyline Leg ${i}: ${seg.fromCameraId} -> ${seg.cameraId} (${seg.transitDistanceMeters}m @ ${seg.calculatedSpeedKmh} km/h)`);
    }
  });

  // 3. Verify Vehicle Profile Sighting & History Integration
  await test('Verify Vehicle Profile & Detection History (MP04AB1234)', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/MP04AB1234/history`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();

    if (!body.success || !body.data) throw new Error('Vehicle history failed');
    if (body.data.totalSightings < 4) {
      throw new Error(`Expected >= 4 sightings, found ${body.data.totalSightings}`);
    }
    console.log(`   Vehicle Profile loaded: ${body.data.plateNumber} | Total Sightings: ${body.data.totalSightings}`);
  });

  // 4. Verify Multi-Camera Trajectory for Second Vehicle DL01CA1234
  await test('Seed & Verify 3-Camera Trajectory for Second Vehicle (DL01CA1234)', async () => {
    // Add additional camera sighting for DL01CA1234 to form >= 3 camera trajectory
    await fetch(`${BASE_URL}/detections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber: 'DL01CA1234',
        confidence: 0.95,
        cameraId: 'CAM-IND-03',
        timestamp: '2026-09-30T10:35:00Z',
        direction: 'SOUTHBOUND',
        speed: 57
      })
    });

    await fetch(`${BASE_URL}/detections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber: 'DL01CA1234',
        confidence: 0.97,
        cameraId: 'CAM-IND-04',
        timestamp: '2026-09-30T10:48:30Z',
        direction: 'WESTBOUND',
        speed: 62
      })
    });

    const res = await fetch(`${BASE_URL}/vehicles/DL01CA1234/trajectory`);
    const body = await res.json();
    if (!body.success || body.pointCount < 3) {
      throw new Error(`Expected >= 3 cameras for DL01CA1234, found ${body.pointCount}`);
    }
    console.log(`   DL01CA1234 Trajectory: ${body.routeSequence.join(' → ')} (${body.pointCount} camera nodes)`);
  });

  console.log(`=======================================================`);
  console.log(`PHASE 6 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) process.exit(1);
}

runGISTests();
