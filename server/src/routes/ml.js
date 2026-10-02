import express from 'express';
import { getMlStatus } from '../services/aiInferenceService.js';

const router = express.Router();

// GET /api/ml/status - is the AI engine connected / awake?
router.get('/status', async (req, res, next) => {
  try {
    res.json({ success: true, ...(await getMlStatus()) });
  } catch (err) {
    next(err);
  }
});

export default router;
