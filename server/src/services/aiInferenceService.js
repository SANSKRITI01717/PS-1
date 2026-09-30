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

// Duplicate detection cache: Map<`${plate}_${cameraId}`, lastSeenTimestamp>
const recentDetections = new Map();
const DEDUPLICATION_WINDOW_MS = 5000; // 5-second suppression for identical camera + plate

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

    return new Promise((resolve, reject) => {
      const args = [
        AI_SCRIPT,
        '--image', imagePath,
        '--model', MODEL_PATH,
        '--conf', String(minConf),
        '--ocr_floor', String(ocrFloor)
      ];

      console.log(`[AI Pipeline] Spawning inference: ${PYTHON_CMD} ${args.join(' ')}`);
      const proc = spawn(PYTHON_CMD, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      // 30s timeout guard
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('AI Inference timed out after 30 seconds'));
      }, 30000);

      proc.on('close', async (code) => {
        clearTimeout(timer);

        if (code !== 0) {
          console.error(`[AI Pipeline Error] Stderr: ${stderr}`);
          return resolve({
            success: false,
            error: `Inference process exited with code ${code}`,
            rawError: stderr.trim(),
            detections: []
          });
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (!parsed.success) {
            return resolve({
              success: false,
              error: parsed.error || 'Failed to process image',
              detections: []
            });
          }

          // Handle unreadable / no plate detected
          if (!parsed.detections || parsed.detections.length === 0) {
            return resolve({
              success: true,
              readablePlate: false,
              message: 'No readable license plate detected in frame.',
              inferenceTimeMs: parsed.inferenceTimeMs,
              detections: []
            });
          }

          // Process each detected plate
          const savedRecords = [];
          const now = Date.now();

          for (const det of parsed.detections) {
            const plate = det.plateNumber.toUpperCase();
            const dedupeKey = `${plate}_${camera.cameraId}`;
            const lastSeenTime = recentDetections.get(dedupeKey);

            const isDuplicate = lastSeenTime && (now - lastSeenTime < DEDUPLICATION_WINDOW_MS);
            recentDetections.set(dedupeKey, now);

            if (isDuplicate) {
              console.log(`[AI Pipeline] Duplicate detection suppressed for ${plate} at ${camera.cameraId} (within ${DEDUPLICATION_WINDOW_MS}ms)`);
              savedRecords.push({
                plateNumber: plate,
                confidence: det.confidence,
                bbox: det.bbox,
                isDuplicate: true,
                status: 'DUPLICATE_IGNORED'
              });
              continue;
            }

            // Save record in data store
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
              metadata: {
                sharpness: det.sharpness,
                yoloConfidence: det.yoloConfidence,
                inferenceTimeMs: parsed.inferenceTimeMs
              }
            });

            // Emit real-time socket event if io is provided
            if (io) {
              io.emit('detection:new', {
                detection: record,
                camera
              });
            }

            savedRecords.push(record);
          }

          resolve({
            success: true,
            readablePlate: true,
            inferenceTimeMs: parsed.inferenceTimeMs,
            device: parsed.device,
            totalDetections: savedRecords.length,
            records: savedRecords
          });

        } catch (err) {
          console.error('[AI Pipeline] JSON parse error:', err.message, 'Raw stdout:', stdout);
          reject(new Error(`Failed to parse AI output: ${err.message}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
    });
  }
}
