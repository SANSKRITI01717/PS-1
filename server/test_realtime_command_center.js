import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:5000';

async function runRealtimeCommandCenterTests() {
  console.log('--- STARTING PHASE 7 REAL-TIME COMMAND CENTER VERIFICATION ---\n');
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

  // 1. GET /api/command-center/summary
  await test('Command Center Summary Aggregation API', async () => {
    const res = await fetch(`${BASE_URL}/api/command-center/summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.stats) throw new Error('Invalid summary structure');

    const s = body.stats;
    if (typeof s.activeCameras !== 'number' || typeof s.detectionsToday !== 'number' || typeof s.uniqueVehicles !== 'number') {
      throw new Error('Summary stats missing core numeric counters');
    }

    console.log(`   Terminals: ${s.activeCameras}/${s.totalCameras} Active | Detections: ${s.detectionsToday} | Unique Vehicles: ${s.uniqueVehicles} | Flow: ${s.trafficCondition}`);
  });

  // 2. Real-Time Socket.IO Live Detection & Alert Broadcast
  await test('Socket.IO Real-Time Stream Verification (Zero-Reload)', async () => {
    const socket = io(BASE_URL, { transports: ['websocket'] });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket.IO connection timed out'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log(`   Socket.IO connected with Client ID: ${socket.id}`);
        resolve();
      });
    });

    let receivedDetection = null;
    let receivedAlert = null;

    socket.on('detection:new', (payload) => {
      receivedDetection = payload;
    });

    socket.on('alert:new', (alertPayload) => {
      receivedAlert = alertPayload;
    });

    // Ingest a detection with a blacklisted plate to trigger BOTH detection and alert events
    const triggerRes = await fetch(`${BASE_URL}/api/detections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber: 'DL01AB9999',
        confidence: 0.985,
        cameraId: 'CAM-IND-01',
        speed: 74.2,
        direction: 'NORTHBOUND'
      })
    });

    if (!triggerRes.ok) throw new Error('Failed to post trigger detection');

    // Wait for real-time events to arrive via Socket.IO
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (receivedDetection && receivedAlert) {
          clearInterval(interval);
          resolve();
        } else if (attempts > 30) {
          clearInterval(interval);
          reject(new Error(`Timed out waiting for socket events: detection=${!!receivedDetection}, alert=${!!receivedAlert}`));
        }
      }, 100);
    });

    socket.disconnect();

    if (receivedDetection.detection.plateNumber !== 'DL01AB9999') {
      throw new Error(`Socket detection mismatch: ${receivedDetection.detection.plateNumber}`);
    }
    if (receivedAlert.plateNumber !== 'DL01AB9999') {
      throw new Error(`Socket alert mismatch: ${receivedAlert.plateNumber}`);
    }

    console.log(`   Real-Time Event 1 Received: detection:new -> ${receivedDetection.detection.plateNumber} at ${receivedDetection.camera.cameraId}`);
    console.log(`   Real-Time Event 2 Received: alert:new -> ${receivedAlert.severity} ${receivedAlert.type} for ${receivedAlert.plateNumber}`);
  });

  console.log(`=======================================================`);
  console.log(`PHASE 7 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) process.exit(1);
}

runRealtimeCommandCenterTests();
