import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dataStore } from '../repositories/dataStore.js';
import { AIInferenceService } from '../services/aiInferenceService.js';
import { AnomalyDetector } from '../services/anomalyDetector.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage for uploaded inspection frames
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `frame_${Date.now()}_${Math.random().toString(36).substr(2, 6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

const router = express.Router();

// GET /api/detections - List recent detections with query filtering
router.get('/', async (req, res, next) => {
  try {
    const { plateNumber, cameraId, limit } = req.query;
    const filter = {};
    if (plateNumber) filter.plateNumber = plateNumber.toUpperCase();
    if (cameraId) filter.cameraId = cameraId;

    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const detections = await dataStore.getDetections(filter, parsedLimit);

    res.json({
      success: true,
      count: detections.length,
      data: detections
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/detections/:id - Get single detection details
router.get('/:id', async (req, res, next) => {
  try {
    const detection = await dataStore.getDetectionById(req.params.id);
    if (!detection) {
      return res.status(404).json({
        success: false,
        message: `Detection record '${req.params.id}' not found.`
      });
    }
    res.json({
      success: true,
      data: detection
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/detections - Record a new vehicle detection manually
router.post('/', async (req, res, next) => {
  try {
    const { plateNumber, confidence, cameraId, timestamp, imagePath, bbox, direction, speed, vehicleType, metadata } = req.body;

    // Validation
    if (!plateNumber || confidence === undefined || !cameraId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: plateNumber, confidence, cameraId.'
      });
    }

    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return res.status(400).json({
        success: false,
        message: 'Confidence must be a floating point number between 0 and 1.'
      });
    }

    const camera = await dataStore.getCameraById(cameraId);
    if (!camera) {
      console.warn(`[Detections] Warning: Camera '${cameraId}' not pre-registered in system.`);
    }

    const detectionRecord = await dataStore.createDetection({
      plateNumber: plateNumber.toUpperCase().trim(),
      confidence,
      cameraId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      imagePath: imagePath || '',
      bbox: bbox || { x1: 0, y1: 0, x2: 0, y2: 0 },
      direction: direction || (camera ? camera.direction : 'FORWARD'),
      speed: speed || null,
      vehicleType: vehicleType || 'CAR',
      metadata: metadata || {}
    });

    // Real-time broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('detection:new', {
        detection: detectionRecord,
        camera: camera || { cameraId, name: cameraId }
      });

      if (detectionRecord.alertTriggered) {
        io.emit('alert:new', detectionRecord.alertTriggered);
      }
    }

    // Run route anomaly detection rules
    const anomalyAlert = await AnomalyDetector.evaluateDetection(detectionRecord, io);
    if (anomalyAlert) {
      detectionRecord.anomalyAlert = anomalyAlert;
    }

    res.status(201).json({
      success: true,
      message: 'Detection logged successfully.',
      data: detectionRecord
    });

  } catch (err) {
    next(err);
  }
});

// POST /api/detections/process-image - Ingest image file/upload and run AI YOLO + OCR Pipeline
router.post('/process-image', upload.single('image'), async (req, res, next) => {
  try {
    let filePath = null;
    let cameraId = req.body.cameraId || 'CAM-IND-01';

    if (req.file) {
      filePath = req.file.path;
    } else if (req.body.imagePath) {
      filePath = path.resolve(req.body.imagePath);
    } else {
      return res.status(400).json({
        success: false,
        message: 'No image provided. Upload a file as multipart/form-data or provide imagePath in JSON.'
      });
    }

    const io = req.app.get('io');
    const result = await AIInferenceService.processImage(filePath, cameraId, {
      minConf: req.body.minConf ? parseFloat(req.body.minConf) : 0.25,
      ocrFloor: req.body.ocrFloor ? parseFloat(req.body.ocrFloor) : 0.45,
      io
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
