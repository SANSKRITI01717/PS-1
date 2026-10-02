import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { dataStore } from '../repositories/dataStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to AI engine
const AI_SCRIPT = path.resolve(__dirname, '../../../AI-Model/inference_engine.py');
const MODEL_PATH = path.resolve(__dirname, '../../../AI-Model/models/custom_trained_model.pt');
const PYTHON_CMD = process.env.PYTHON_PATH || 'python';
const CONFIG_FILE = path.resolve(__dirname, '../../ml-config.json');

// ML service link: env var ML_URL wins, otherwise server/ml-config.json ("mlUrl").
function readMlUrl() {
  let url = process.env.ML_URL || '';
  if (!url) {
    try { url = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).mlUrl || ''; } catch (e) { /* no file = not configured */ }
  }
  return String(url).trim().replace(/\/+$/, '');
}
const ML_URL = readMlUrl(); // e.g. https://anpr-ml.onrender.com

// Duplicate detection cache: Map<`${plate}_${cameraId}`, lastSeenTimestamp>
const recentDetections = new Map();
const DEDUPLICATION_WINDOW_MS = 5000; // 5-second suppression for identical camera + plate


// ---- Inference runners: remote ML service (if ML_URL set) or local Python ----
function runLocalInference(imagePath, minConf, ocrFloor) {
  return new Promise((resolve, reject) => {
    const args = [AI_SCRIPT, '--image', imagePath, '--model', MODEL_PATH,
      '--conf', String(minConf), '--ocr_floor', String(ocrFloor)];
    console.log(`[AI Pipeline] Spawning inference: ${PYTHON_CMD} ${args.join(' ')}`);
    const proc = spawn(PYTHON_CMD, args);
    let stdout = '', stderr = '';
    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error('AI Inference timed out after 30 seconds')); }, 30000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.error(`[AI Pipeline Error] Stderr: ${stderr}`);
        return reject(new Error(`Inference process exited with code ${code}`));
      }
      try { resolve(JSON.parse(stdout.trim())); }
      catch (err) { reject(new Error(`Failed to parse AI output: ${err.message}`)); }
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(new Error(`Failed to start Python process: ${err.message}`)); });
  });
}

async function runRemoteInference(imagePath, minConf, ocrFloor) {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(imagePath)]), path.basename(imagePath));
  form.append('conf', String(minConf));
  form.append('ocr_floor', String(ocrFloor));
  console.log(`[AI Pipeline] Calling ML service: ${ML_URL}/predict`);
  // 90s: free hosts may need time to wake up on the first request
  const res = await fetch(`${ML_URL}/predict`, { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`ML service responded ${res.status}`);
  return res.json();
}

// Is the AI engine reachable? Used by the UI (and it also wakes a sleeping free-tier ML service).
export async function getMlStatus() {
  if (ML_URL) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${ML_URL}/health`, { signal: AbortSignal.timeout(8000) });
      return { mode: 'remote', configured: true, online: res.ok, waking: false, latencyMs: Date.now() - t0, host: new URL(ML_URL).host };
    } catch (e) {
      // timeout / connection error: a free host that is asleep usually answers after ~30-60s
      return { mode: 'remote', configured: true, online: false, waking: true, host: new URL(ML_URL).host };
    }
  }
  // No link: local Python only works on a developer machine, never on Render
  if (process.env.RENDER) return { mode: 'none', configured: false, online: false, waking: false };
  return { mode: 'local', configured: true, online: true, waking: false };
}

export class AIInferenceService {
  /**
   * Run inference on an image file using the existing trained model + fast-plate-ocr
   */
  static async processImage(imagePath, cameraId = 'CAM-IND-01', options = {}) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Input image file not found at: ${imagePath}`);
    }

    const { minConf = 0.25, ocrFloor = 0.45, io = null } = options;

    // Verify or fetch camera
    let camera = await dataStore.getCameraById(cameraId);
    if (!camera) {
      // Graceful fallback for missing camera
      const allCameras = await dataStore.getCameras();
      camera = allCameras[0] || {
        cameraId: cameraId || 'DEFAULT-CAM',
        name: 'Unassigned Terminal Camera',
        location: 'City Perimeter',
        coordinates: { lat: 28.4735, lng: 77.0812 },
        direction: 'NORTHBOUND'
      };
    }

    if (!ML_URL && process.env.RENDER) {
      return { success: false, error: 'AI engine is not connected yet. Add the ML service link in server/ml-config.json (or the ML_URL setting) and redeploy.', detections: [] };
    }

    let parsed;
    try {
      parsed = ML_URL
        ? await runRemoteInference(imagePath, minConf, ocrFloor)
        : await runLocalInference(imagePath, minConf, ocrFloor);
    } catch (err) {
      console.error('[AI Pipeline] Inference failed:', err.message);
      return { success: false, error: err.message, detections: [] };
    }

    if (!parsed.success) {
      return { success: false, error: parsed.error || 'Failed to process image', detections: [] };
    }

    // Handle unreadable / no plate detected
    if (!parsed.detections || parsed.detections.length === 0) {
      return {
        success: true,
        readablePlate: false,
        message: 'No readable license plate detected in frame.',
        inferenceTimeMs: parsed.inferenceTimeMs,
        detections: []
      };
    }

    const savedRecords = [];
    const now = Date.now();

    for (const det of parsed.detections) {
      const plate = det.plateNumber.toUpperCase();
      const dedupeKey = `${plate}_${camera.cameraId}`;
      const lastSeenTime = recentDetections.get(dedupeKey);
      const isDuplicate = lastSeenTime && (now - lastSeenTime < DEDUPLICATION_WINDOW_MS);
      recentDetections.set(dedupeKey, now);

      if (isDuplicate) {
        console.log(`[AI Pipeline] Duplicate detection suppressed for ${plate} at ${camera.cameraId}`);
        savedRecords.push({ plateNumber: plate, confidence: det.confidence, bbox: det.bbox, isDuplicate: true, status: 'DUPLICATE_IGNORED' });
        continue;
      }

      const record = await dataStore.createDetection({
        plateNumber: plate,
        confidence: det.confidence,
        cameraId: camera.cameraId,
        timestamp: new Date(),
        imagePath: imagePath.replace(/\\/g, '/'),
        bbox: det.bbox,
        direction: camera.direction || 'FORWARD',
        speed: det.speed || null,
        vehicleType: 'CAR',
        metadata: { sharpness: det.sharpness, yoloConfidence: det.yoloConfidence, inferenceTimeMs: parsed.inferenceTimeMs }
      });

      if (io) io.emit('detection:new', { detection: record, camera });
      savedRecords.push(record);
    }

    return {
      success: true,
      readablePlate: true,
      inferenceTimeMs: parsed.inferenceTimeMs,
      device: parsed.device,
      totalDetections: savedRecords.length,
      records: savedRecords
    };
  }
}
