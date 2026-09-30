import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000/api';
const SAMPLE_DIR = path.resolve(__dirname, '../AI-Model/test_samples');

async function runAITests() {
  console.log('--- STARTING PHASE 3 ANPR / OCR AI INTEGRATION SUITE ---\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      console.log(`⏳ Running: ${name}...`);
      await fn();
      console.log(`✅ [PASS] ${name}\n`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}\n`);
      failed++;
    }
  }

  // 1. Process Delhi car image
  await test('Process Delhi Plate (DL01CA1234) via AI Pipeline', async () => {
    const imgPath = path.join(SAMPLE_DIR, 'car_delhi.jpg');
    const res = await fetch(`${BASE_URL}/detections/process-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagePath: imgPath,
        cameraId: 'CAM-IND-01'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.readablePlate) throw new Error('Failed to detect plate');
    if (!body.records || body.records.length === 0) throw new Error('No detection records saved');
    const rec = body.records[0];
    if (rec.plateNumber !== 'DL01CA1234') throw new Error(`Unexpected plate: ${rec.plateNumber}`);
    if (rec.confidence < 0.8) throw new Error(`Low confidence: ${rec.confidence}`);
    console.log(`   Detected: ${rec.plateNumber} | Confidence: ${rec.confidence} | Inference Time: ${body.inferenceTimeMs}ms`);
  });

  // 2. Process Mumbai car image at different camera
  await test('Process Mumbai Plate (MH12AB1234) via AI Pipeline', async () => {
    const imgPath = path.join(SAMPLE_DIR, 'car_mumbai.jpg');
    const res = await fetch(`${BASE_URL}/detections/process-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagePath: imgPath,
        cameraId: 'CAM-IND-02'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || !body.readablePlate) throw new Error('Failed to detect plate');
    const rec = body.records[0];
    if (!rec.plateNumber.startsWith('MH12AB')) throw new Error(`Unexpected plate: ${rec.plateNumber}`);
    console.log(`   Detected: ${rec.plateNumber} | Confidence: ${rec.confidence} | Camera: CAM-IND-02`);
  });

  // 3. Duplicate detection suppression
  await test('Graceful Duplicate Detection Suppression within 5s window', async () => {
    const imgPath = path.join(SAMPLE_DIR, 'car_mumbai.jpg');
    const res = await fetch(`${BASE_URL}/detections/process-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagePath: imgPath,
        cameraId: 'CAM-IND-02'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error('API returned failure');
    const rec = body.records[0];
    if (!rec.isDuplicate) throw new Error('Duplicate was not suppressed');
    console.log(`   Deduplication hit: ${rec.status} for ${rec.plateNumber}`);
  });

  // 4. Graceful handling of blurry / unreadable image
  await test('Graceful handling of unreadable/blurry frame (No Crash)', async () => {
    const imgPath = path.join(SAMPLE_DIR, 'road_blurry_empty.jpg');
    const res = await fetch(`${BASE_URL}/detections/process-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagePath: imgPath,
        cameraId: 'CAM-IND-03'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.readablePlate !== false) {
      throw new Error('Expected readablePlate to be false');
    }
    console.log(`   Graceful response: "${body.message}"`);
  });

  // 5. Verify Vehicle Sighting & Trajectory Persistence
  await test('Verify Vehicle Sighting & GIS Trajectory Record in DB', async () => {
    const res = await fetch(`${BASE_URL}/vehicles/DL01CA1234/history`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success || body.data.totalSightings < 1) {
      throw new Error('Vehicle record not found in database');
    }
    const trajRes = await fetch(`${BASE_URL}/vehicles/DL01CA1234/trajectory`);
    const trajBody = await trajRes.json();
    if (!trajBody.success || trajBody.pointCount < 1) {
      throw new Error('Trajectory event was not generated');
    }
    console.log(`   Vehicle DL01CA1234 sightings: ${body.data.totalSightings} | Trajectory Points: ${trajBody.pointCount}`);
  });

  console.log(`=======================================================`);
  console.log(`PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) process.exit(1);
}

runAITests();
