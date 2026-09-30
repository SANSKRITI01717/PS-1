const BASE_URL = 'http://localhost:5000/api';

async function runCameraTests() {
  console.log('--- STARTING PHASE 4 CAMERA MANAGEMENT & LIVE DETECTION SUITE ---\n');
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

  const testCamId = 'CAM-METRO-09';

  // 1. GET /api/cameras
  await test('List cameras with stream status enrichment', async () => {
    const res = await fetch(`${BASE_URL}/cameras`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !Array.isArray(body.data)) throw new Error('Invalid response');
    if (!body.data.every(c => typeof c.isStreaming === 'boolean')) {
      throw new Error('isStreaming boolean not attached to cameras');
    }
    console.log(`   Discovered ${body.count} cameras in network`);
  });

  // 2. POST /api/cameras
  await test('Register new camera with GPS coordinates', async () => {
    const payload = {
      cameraId: testCamId,
      name: 'Metro Corridor Junction Outer',
      location: 'Sector 29 Metro Way NH-48',
      coordinates: { lat: 28.4682, lng: 77.0628 },
      direction: 'NORTHBOUND',
      status: 'ACTIVE',
      feedType: 'SIMULATED'
    };
    const res = await fetch(`${BASE_URL}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.cameraId !== testCamId) throw new Error('Create failed');
    console.log(`   Registered: ${body.data.name} (${body.data.cameraId})`);
  });

  // 3. POST /api/cameras/:id/trigger - Complete pipeline: camera -> feed -> AI -> detection -> database
  await test('End-to-End: camera -> feed -> AI -> detection -> database', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${testCamId}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleIndex: 0 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.records || body.records.length === 0) {
      throw new Error('AI detection trigger returned no records');
    }
    const det = body.records[0];
    if (det.cameraId !== testCamId) {
      throw new Error(`Detection associated with wrong camera: ${det.cameraId}`);
    }
    console.log(`   Captured: ${det.plateNumber} at ${det.cameraId} | Saved with ID: ${det._id}`);
  });

  // 4. POST /api/cameras/:id/stream/start
  await test('Start live streaming simulation on camera', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${testCamId}/stream/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalMs: 8000 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.status !== 'STARTED') throw new Error('Stream start failed');
    console.log(`   Live simulation active for ${testCamId}`);
  });

  // 5. GET /api/cameras/:id check isStreaming
  await test('Verify camera streaming status in details query', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${testCamId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.isStreaming !== true) {
      throw new Error('Camera isStreaming is not true');
    }
    console.log(`   Status verified: isStreaming = ${body.data.isStreaming}`);
  });

  // 6. POST /api/cameras/:id/stream/stop
  await test('Stop live streaming simulation on camera', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${testCamId}/stream/stop`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.status !== 'STOPPED') throw new Error('Stream stop failed');
    console.log(`   Live simulation stopped for ${testCamId}`);
  });

  // 7. PUT /api/cameras/:id
  await test('Update camera parameters and coordinates', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${testCamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'MAINTENANCE', name: 'Updated Metro Corridor Hub' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.status !== 'MAINTENANCE') throw new Error('Update failed');
    console.log(`   Updated status to MAINTENANCE for ${testCamId}`);
  });

  // 8. DELETE /api/cameras/:id
  await test('Decommission and delete camera terminal', async () => {
    const res = await fetch(`${BASE_URL}/cameras/${testCamId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('Delete failed');
    console.log(`   Decommissioned camera ${testCamId}`);
  });

  console.log(`=======================================================`);
  console.log(`PHASE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) process.exit(1);
}

runCameraTests();
