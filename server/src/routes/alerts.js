import express from 'express';
import { dataStore } from '../repositories/dataStore.js';

const router = express.Router();

// GET /api/alerts - List all traffic & ANPR security alerts with query filters
router.get('/', async (req, res, next) => {
  try {
    const { type, severity, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (status) filter.status = status;

    const alerts = await dataStore.getAlerts(filter);
    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts - Create manual or anomaly alert
router.post('/', async (req, res, next) => {
  try {
    const { type, severity, plateNumber, cameraId, location, coordinates, message } = req.body;

    if (!type || !message || !cameraId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, message, cameraId.'
      });
    }

    const alert = await dataStore.createAlert({
      type,
      severity: severity || 'MEDIUM',
      plateNumber: plateNumber ? plateNumber.toUpperCase() : null,
      cameraId,
      location: location || 'Command Zone',
      coordinates: coordinates || { lat: 0, lng: 0 },
      message
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('alert:new', alert);
    }

    res.status(201).json({
      success: true,
      message: 'Alert generated successfully.',
      data: alert
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/status - Update alert status (OPEN, ACKNOWLEDGED, RESOLVED)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, resolvedBy } = req.body;
    const validStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await dataStore.updateAlertStatus(req.params.id, status, resolvedBy);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Alert '${req.params.id}' not found.`
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('alert:status-updated', updated);
    }

    res.json({
      success: true,
      message: `Alert status updated to ${status}.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
