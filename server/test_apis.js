const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING PHASE 2 API VERIFICATION SUITE ---\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  let createdCameraId = 'TEST-CAM-99';
  let createdDetId = null;

  // 1. GET /api/cameras
  await test('GET /api/cameras', async () => {
    const res = await fetch(`${BASE_URL}/cameras`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !Array.isArray(body.data)) throw new Error('Invalid structure');
    if (body.count < 1) throw new Error('Expected seed cameras to be present');
  });

  // 2. POST /api/cameras
  await test('POST /api/cameras', async () => {
    const payload = {
      cameraId: createdCameraId,
      name: 'Test Flyover Surveillance',
      location: 'Test Corridor KM 12',
      coordinates: { lat: 28.4812, lng: 77.0715 },
      status: 'ACTIVE',
      direction: 'SOUTHBOUND'
    };
    const res = await fetch(`${BASE_URL}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.cameraId !== createdCameraId) throw new Error('Data mismatch');
  });

  // 3. GET /api/cameras/:id
  await test('GET /api/cameras/:id', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${createdCameraId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.name !== 'Test Flyover Surveillance') throw new Error('Data mismatch');
  });

  // 4. PUT /api/cameras/:id
  await test('PUT /api/cameras/:id', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${createdCameraId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'MAINTENANCE', name: 'Updated Flyover Cam' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.status !== 'MAINTENANCE') throw new Error('Status not updated');
  });

  // 5. POST /api/blacklist
  await test('POST /api/blacklist', async () => {
    const payload = {
      plateNumber: 'DL01AB9999',
      reason: 'Wanted - Vehicle involved in highway robbery',
      severity: 'CRITICAL',
      addedBy: 'State Police Cyber Cell'
    };
    const res = await fetch(`${BASE_URL}/blacklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.plateNumber !== 'DL01AB9999') throw new Error('Blacklist insert failed');
  });

  // 6. GET /api/blacklist
  await test('GET /api/blacklist', async () => {
    const res = await fetch(`${BASE_URL}/blacklist`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.data.some(b => b.plateNumber === 'DL01AB9999')) {
      throw new Error('Blacklisted plate not found in list');
    }
  });

  // 7. POST /api/detections
  await test('POST /api/detections (Triggers blacklist & trajectory)', async () => {
    const payload = {
      plateNumber: 'DL01AB9999',
      confidence: 0.965,
      cameraId: 'CAM-IND-01',
      bbox: { x1: 120, y1: 210, x2: 340, y2: 290 },
      direction: 'NORTHBOUND',
      speed: 62.4,
      vehicleType: 'SUV'
    };
    const res = await fetch(`${BASE_URL}/detections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.plateNumber !== 'DL01AB9999') throw new Error('Detection save failed');
    createdDetId = body.data._id;
  });

  // 8. GET /api/detections
  await test('GET /api/detections', async () => {
    const res = await fetch(`${BASE_URL}/detections?plateNumber=DL01AB9999`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.count < 1) throw new Error('Detections query failed');
  });

  // 9. GET /api/detections/:id
  await test('GET /api/detections/:id', async () => {
    const res = await fetch(`${BASE_URL}/detections/${createdDetId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data._id !== createdDetId) throw new Error('Detection lookup failed');
  });

  // 10. GET /api/vehicles/:plate/history
  await test('GET /api/vehicles/:plate/history', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/DL01AB9999/history`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.data.isBlacklisted || body.data.totalSightings < 1) {
      throw new Error('Vehicle history failed to reflect blacklist flag or sightings');
    }
  });

  // 11. GET /api/vehicles/:plate/trajectory
  await test('GET /api/vehicles/:plate/trajectory', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/DL01AB9999/trajectory`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.pointCount < 1 || !body.trajectory[0].coordinates) {
      throw new Error('Trajectory point missing coordinates or failed to generate');
    }
  });

  // 12. GET /api/alerts
  await test('GET /api/alerts (Automatic alert from blacklist hit)', async () => {
    const res = await fetch(`${BASE_URL}/alerts?severity=CRITICAL`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.data.some(a => a.plateNumber === 'DL01AB9999')) {
      throw new Error('Automated blacklist alert was not triggered upon detection');
    }
  });

  // 13. DELETE /api/cameras/:id
  await test('DELETE /api/cameras/:id', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${createdCameraId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Delete camera failed');
  });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
