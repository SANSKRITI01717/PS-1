import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dataStore } from '../repositories/dataStore.js';
import { cameraFeedSimulator } from '../services/cameraFeedSimulator.js';
import { AIInferenceService } from '../services/aiInferenceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `cam_${req.params.id || 'feed'}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const router = express.Router();

// GET /api/cameras - List all cameras
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const cameras = await dataStore.getCameras(filter);
    
    // Attach current live streaming simulation status
    const enriched = cameras.map(cam => ({
      ...(cam.toObject ? cam.toObject() : cam),
      isStreaming: cameraFeedSimulator.isSimulating(cam.cameraId)
    }));

    res.json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cameras/:id - Get camera by ID or cameraId
router.get('/:id', async (req, res, next) => {
  try {
    const camera = await dataStore.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({
        success: false,
        message: `Camera with ID '${req.params.id}' not found.`
      });
    }

    const camObj = camera.toObject ? camera.toObject() : camera;
    res.json({
      success: true,
      data: {
        ...camObj,
        isStreaming: cameraFeedSimulator.isSimulating(camObj.cameraId)
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/cameras - Add a new camera
router.post('/', async (req, res, next) => {
  try {
    const { cameraId, name, location, coordinates, status, feedType, streamUrl, direction } = req.body;

    // Validation
    if (!cameraId || !name || !location || !coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: cameraId, name, location, coordinates (lat, lng).'
      });
    }

    if (typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates: lat and lng must be numbers.'
      });
    }

    // Check duplicate
    const existing = await dataStore.getCameraById(cameraId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Camera with cameraId '${cameraId}' already exists.`
      });
    }

    const newCamera = await dataStore.createCamera({
      cameraId,
      name,
      location,
      coordinates,
      status: status || 'ACTIVE',
      feedType: feedType || 'SIMULATED',
      streamUrl: streamUrl || '',
      direction: direction || 'NORTHBOUND'
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('camera:created', newCamera);
    }

    res.status(201).json({
      success: true,
      message: 'Camera created successfully.',
      data: newCamera
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/cameras/:id - Edit an existing camera
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await dataStore.updateCamera(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Camera with ID '${req.params.id}' not found.`
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('camera:updated', updated);
    }

    res.json({
      success: true,
      message: 'Camera updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cameras/:id - Remove a camera
router.delete('/:id', async (req, res, next) => {
  try {
    cameraFeedSimulator.stopSimulation(req.params.id);
    const deleted = await dataStore.deleteCamera(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Camera with ID '${req.params.id}' not found.`
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('camera:deleted', { id: req.params.id });
    }

    res.json({
      success: true,
      message: 'Camera deleted successfully.',
      data: deleted
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/cameras/:id/stream/start - Start live stream simulation
router.post('/:id/stream/start', async (req, res, next) => {
  try {
    const camera = await dataStore.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found.' });
    }
    const io = req.app.get('io');
    const intervalMs = req.body.intervalMs || 6000;
    const simResult = cameraFeedSimulator.startSimulation(camera.cameraId, intervalMs, io);
    res.json({ success: true, ...simResult });
  } catch (err) {
    next(err);
  }
});

// POST /api/cameras/:id/stream/stop - Stop live stream simulation
router.post('/:id/stream/stop', async (req, res, next) => {
  try {
    const camera = await dataStore.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found.' });
    }
    const io = req.app.get('io');
    const simResult = cameraFeedSimulator.stopSimulation(camera.cameraId, io);
    res.json({ success: true, ...simResult });
  } catch (err) {
    next(err);
  }
});

// POST /api/cameras/:id/trigger - Trigger on-demand vehicle capture through AI pipeline
router.post('/:id/trigger', async (req, res, next) => {
  try {
    const camera = await dataStore.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found.' });
    }
    const io = req.app.get('io');
    const sampleIdx = req.body.sampleIndex || Math.floor(Math.random() * 3);
    const inferenceResult = await cameraFeedSimulator.triggerSingleFrame(camera.cameraId, sampleIdx, io);
    res.json({ success: true, camera: camera.cameraId, ...inferenceResult });
  } catch (err) {
    next(err);
  }
});

// POST /api/cameras/:id/upload - Upload an image directly to this camera
router.post('/:id/upload', upload.single('media'), async (req, res, next) => {
  try {
    const camera = await dataStore.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No media file provided.' });
    }

    const io = req.app.get('io');
    const result = await AIInferenceService.processImage(req.file.path, camera.cameraId, { io });
    res.json({ success: true, camera: camera.cameraId, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
