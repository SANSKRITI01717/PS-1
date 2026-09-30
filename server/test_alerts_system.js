import io from 'socket.io-client';

const API_BASE = 'http://127.0.0.1:5000';

async function runAlertsTest() {
  console.log('====================================================');
  console.log('SIH PS-26127: PHASE 10 - BLACKLIST & ANOMALY ALERT TEST');
  console.log('====================================================\n');

  let passedTests = 0;
  const totalTests = 5;

  // Setup Socket.IO listener
  const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  const receivedSocketEvents = [];

  socket.on('alert:new', (data) => {
    receivedSocketEvents.push({ event: 'alert:new', data });
  });
  socket.on('alert:status-updated', (data) => {
    receivedSocketEvents.push({ event: 'alert:status-updated', data });
  });
  socket.on('blacklist:updated', (data) => {
    receivedSocketEvents.push({ event: 'blacklist:updated', data });
  });

  await new Promise(r => setTimeout(r, 600));

  // Test 1: Blacklist CRUD Operations
  console.log('[Test 1/5] Testing Blacklist Creation, Status Toggle, and List retrieval...');
  try {
    const testPlate = 'TS09UB9999';
    // Add to blacklist
    const addRes = await fetch(`${API_BASE}/api/blacklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber: testPlate,
        reason: 'Suspected armed transit across state border',
        severity: 'CRITICAL',
        addedBy: 'Inter-State Crime Intelligence Bureau'
      })
    });
    const addData = await addRes.json();

    // Toggle status to inactive
    const patchRes = await fetch(`${API_BASE}/api/blacklist/${testPlate}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false })
    });
    const patchData = await patchRes.json();

    // Re-activate
    await fetch(`${API_BASE}/api/blacklist/${testPlate}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true })
    });

    // List blacklist
    const listRes = await fetch(`${API_BASE}/api/blacklist`);
    const listData = await listRes.json();
    const found = listData.data.find(b => b.plateNumber === testPlate);

    if (addData.success && patchData.success && found && found.isActive) {
      console.log(`✓ Test 1 Passed: Blacklist entry created, toggled, and persisted for ${testPlate}.`);
      passedTests++;
    } else {
      console.error('✗ Test 1 Failed:', { addData, patchData, found });
    }
  } catch (err) {
    console.error('✗ Test 1 Error:', err.message);
  }

  // Test 2: Sighting of Blacklisted Plate triggers Real-Time Alert
  console.log('\n[Test 2/5] Testing Blacklist hit detection & automated Alert generation...');
  let blacklistAlertId = null;
  try {
    const testPlate = 'TS09UB9999';
    const detectRes = await fetch(`${API_BASE}/api/detections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber: testPlate,
        confidence: 0.96,
        cameraId: 'CAM-IND-01',
        timestamp: new Date().toISOString(),
        direction: 'FORWARD'
      })
    });
    const detectData = await detectRes.json();

    if (detectData.success && detectData.data.alertTriggered) {
      blacklistAlertId = detectData.data.alertTriggered._id;
      console.log(`✓ Test 2 Passed: Blacklist alert triggered successfully!`);
      console.log(`   Alert Type: ${detectData.data.alertTriggered.type}`);
      console.log(`   Message: ${detectData.data.alertTriggered.message}`);
      passedTests++;
    } else {
      console.error('✗ Test 2 Failed: No alert triggered for blacklisted plate.', detectData);
    }
  } catch (err) {
    console.error('✗ Test 2 Error:', err.message);
  }

  // Test 3: Physically Implausible Rapid Transit Anomaly Detection
  console.log('\n[Test 3/5] Testing Route Anomaly Detector (>2km covered in 10s -> Cloned Plate / Rapid Transit)...');
  let anomalyAlertId = null;
  try {
    const anomalyPlate = 'UP32AZ8888';
    const now = Date.now();

    // Sighting 1 at CAM-IND-01 (MG Road Junction)
    await fetch(`${API_BASE}/api/detections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber: anomalyPlate,
        confidence: 0.94,
        cameraId: 'CAM-IND-01',
        timestamp: new Date(now - 10000).toISOString(),
        direction: 'FORWARD'
      })
    });

    // Sighting 2 at CAM-IND-03 (Golf Course Road, ~2.1km away) only 10s later
    const s2Res = await fetch(`${API_BASE}/api/detections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plateNumber: anomalyPlate,
        confidence: 0.95,
        cameraId: 'CAM-IND-03',
        timestamp: new Date(now).toISOString(),
        direction: 'SOUTHBOUND'
      })
    });
    const s2Data = await s2Res.json();

    if (s2Data.success && s2Data.data.anomalyAlert) {
      anomalyAlertId = s2Data.data.anomalyAlert._id;
      console.log(`✓ Test 3 Passed: Route anomaly detected!`);
      console.log(`   Anomaly Type: ${s2Data.data.anomalyAlert.type}`);
      console.log(`   Severity: ${s2Data.data.anomalyAlert.severity}`);
      console.log(`   Details: ${s2Data.data.anomalyAlert.message}`);
      passedTests++;
    } else {
      console.error('✗ Test 3 Failed: Anomaly detector did not fire for rapid jump.', s2Data);
    }
  } catch (err) {
    console.error('✗ Test 3 Error:', err.message);
  }

  // Test 4: Alert Status Triage Lifecycle (OPEN -> ACKNOWLEDGED -> RESOLVED)
  console.log('\n[Test 4/5] Testing Alert Status Workflow (ACKNOWLEDGED & RESOLVED)...');
  try {
    const targetAlertId = blacklistAlertId || anomalyAlertId;
    if (!targetAlertId) {
      console.error('✗ Test 4 Failed: No alert ID available to patch.');
    } else {
      // Step A: Acknowledge
      const ackRes = await fetch(`${API_BASE}/api/alerts/${targetAlertId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACKNOWLEDGED', resolvedBy: 'Inspector Verma (PCR-04)' })
      });
      const ackData = await ackRes.json();

      // Step B: Resolve
      const resRes = await fetch(`${API_BASE}/api/alerts/${targetAlertId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED', resolvedBy: 'Duty Officer Sharma' })
      });
      const resData = await resRes.json();

      if (ackData.success && ackData.data.status === 'ACKNOWLEDGED' &&
          resData.success && resData.data.status === 'RESOLVED') {
        console.log(`✓ Test 4 Passed: Alert status transitioned from OPEN -> ACKNOWLEDGED -> RESOLVED.`);
        passedTests++;
      } else {
        console.error('✗ Test 4 Failed:', { ackData, resData });
      }
    }
  } catch (err) {
    console.error('✗ Test 4 Error:', err.message);
  }

  // Test 5: Verify Socket.IO Broadcasts & Alerts API Filtering
  console.log('\n[Test 5/5] Verifying Socket.IO Real-time Events & Alert Filters...');
  try {
    // Check Socket.IO events captured
    const alertNewEvents = receivedSocketEvents.filter(e => e.event === 'alert:new');
    const alertStatusEvents = receivedSocketEvents.filter(e => e.event === 'alert:status-updated');

    // Filter alerts endpoint
    const filterRes = await fetch(`${API_BASE}/api/alerts?status=RESOLVED`);
    const filterData = await filterRes.json();

    if (alertNewEvents.length >= 1 && filterData.success && filterData.data.length >= 1) {
      console.log(`✓ Test 5 Passed: Received ${alertNewEvents.length} 'alert:new' & ${alertStatusEvents.length} 'alert:status-updated' socket events.`);
      console.log(`   Found ${filterData.count} RESOLVED alert(s) via query filtering.`);
      passedTests++;
    } else {
      console.error('✗ Test 5 Failed: Socket events or alert filter mismatch.', {
        alertNewCount: alertNewEvents.length,
        filterCount: filterData.count
      });
    }
  } catch (err) {
    console.error('✗ Test 5 Error:', err.message);
  }

  socket.disconnect();

  console.log('\n====================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('>>> PHASE 10: BLACKLIST & ANOMALY ALERT ENGINE FULLY VERIFIED <<<\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAlertsTest();
