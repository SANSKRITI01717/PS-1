import express from 'express';
import { dataStore } from '../repositories/dataStore.js';
import { TrajectoryEngine } from '../services/trajectoryEngine.js';

const router = express.Router();

// GET /api/vehicles/:plate/history - Complete vehicle sighting and profile history
router.get('/:plate/history', async (req, res, next) => {
  try {
    const { plate } = req.params;
    if (!plate) {
      return res.status(400).json({
        success: false,
        message: 'Plate parameter is required.'
      });
    }

    const history = await dataStore.getVehicleHistory(plate);

    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/vehicles/:plate/trajectory - Reconstruct multi-camera trajectory sequence
router.get('/:plate/trajectory', async (req, res, next) => {
  try {
    const { plate } = req.params;
    if (!plate) {
      return res.status(400).json({
        success: false,
        message: 'Plate parameter is required.'
      });
    }

    const result = await TrajectoryEngine.reconstructTrajectory(plate);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
