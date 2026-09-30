import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { AIInferenceService } from './aiInferenceService.js';
import { dataStore } from '../repositories/dataStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_DIR = path.resolve(__dirname, '../../../AI-Model/test_samples');

class CameraFeedSimulator {
  constructor() {
    this.activeSimulations = new Map(); // cameraId -> intervalHandle
    this.samplePool = [
      { file: 'car_delhi.jpg', plate: 'DL01CA1234', type: 'SEDAN' },
      { file: 'car_mumbai.jpg', plate: 'MH12AB1234', type: 'SUV' },
      { file: 'car_up.jpg', plate: 'UP16CD5678', type: 'TRUCK' }
    ];
  }

  /**
   * Start a simulated live camera stream that triggers detections at regular intervals
   */
  startSimulation(cameraId, intervalMs = 6000, io = null) {
    if (this.activeSimulations.has(cameraId)) {
      return { status: 'ALREADY_RUNNING', cameraId };
    }

    console.log(`[Simulator] Starting live simulated feed for camera: ${cameraId} (${intervalMs}ms interval)`);
    
    // Broadcast camera stream started
    if (io) {
      io.emit('camera:stream-status', { cameraId, streaming: true, mode: 'SIMULATED' });
    }

    const intervalHandle = setInterval(async () => {
      try {
        const camera = await dataStore.getCameraById(cameraId);
        if (!camera || camera.status === 'INACTIVE') {
          this.stopSimulation(cameraId, io);
          return;
        }

        // Pick a sample vehicle frame
        const sample = this.samplePool[Math.floor(Math.random() * this.samplePool.length)];
        const samplePath = path.join(SAMPLE_DIR, sample.file);

        if (fs.existsSync(samplePath)) {
          console.log(`[Simulator] Camera ${cameraId} capturing live frame: ${sample.file}`);
          await AIInferenceService.processImage(samplePath, cameraId, { io });
        }
      } catch (err) {
        console.error(`[Simulator Error] Camera ${cameraId}:`, err.message);
      }
    }, intervalMs);

    this.activeSimulations.set(cameraId, intervalHandle);
    return { status: 'STARTED', cameraId, intervalMs };
  }

  /**
   * Stop simulation for a specific camera
   */
  stopSimulation(cameraId, io = null) {
    if (this.activeSimulations.has(cameraId)) {
      clearInterval(this.activeSimulations.get(cameraId));
      this.activeSimulations.delete(cameraId);
      console.log(`[Simulator] Stopped live simulated feed for camera: ${cameraId}`);

      if (io) {
        io.emit('camera:stream-status', { cameraId, streaming: false });
      }
      return { status: 'STOPPED', cameraId };
    }
    return { status: 'NOT_RUNNING', cameraId };
  }

  /**
   * Trigger a single simulated capture on demand
   */
  async triggerSingleFrame(cameraId, sampleIndex = 0, io = null) {
    const sample = this.samplePool[sampleIndex % this.samplePool.length];
    const samplePath = path.join(SAMPLE_DIR, sample.file);
    if (!fs.existsSync(samplePath)) {
      throw new Error(`Sample frame file not found: ${samplePath}`);
    }
    return await AIInferenceService.processImage(samplePath, cameraId, { io });
  }

  isSimulating(cameraId) {
    return this.activeSimulations.has(cameraId);
  }

  getAllActiveSimulations() {
    return Array.from(this.activeSimulations.keys());
  }
}

export const cameraFeedSimulator = new CameraFeedSimulator();
