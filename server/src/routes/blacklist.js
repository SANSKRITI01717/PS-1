import express from 'express';
import { dataStore } from '../repositories/dataStore.js';

const router = express.Router();

// GET /api/blacklist - List all blacklisted plates
router.get('/', async (req, res, next) => {
  try {
    const list = await dataStore.getBlacklist();
    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/blacklist - Add a plate to the blacklist
router.post('/', async (req, res, next) => {
  try {
    const { plateNumber, reason, severity, addedBy, notes } = req.body;

    if (!plateNumber || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: plateNumber, reason.'
      });
    }

    const record = await dataStore.addToBlacklist({
      plateNumber: plateNumber.toUpperCase().trim(),
      reason,
      severity: severity || 'HIGH',
      addedBy: addedBy || 'Traffic Enforcement Cell',
      notes: notes || ''
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('blacklist:updated', record);
    }

    res.status(201).json({
      success: true,
      message: 'Vehicle successfully added to city blacklist.',
      data: record
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/blacklist/:plate/status - Activate or deactivate blacklist entry
router.patch('/:plate/status', async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
    }

    const updated = await dataStore.updateBlacklistStatus(req.params.plate, isActive);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Blacklist entry not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('blacklist:status-changed', updated);
    }

    res.json({
      success: true,
      message: `Blacklist entry for ${req.params.plate} is now ${isActive ? 'ACTIVE' : 'INACTIVE'}.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/blacklist/:plate - Remove plate from blacklist
router.delete('/:plate', async (req, res, next) => {
  try {
    const removed = await dataStore.deleteBlacklist(req.params.plate);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Blacklist entry not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('blacklist:deleted', { plateNumber: req.params.plate });
    }

    res.json({
      success: true,
      message: `Vehicle ${req.params.plate} removed from city blacklist.`,
      data: removed
    });
  } catch (err) {
    next(err);
  }
});

export default router;
