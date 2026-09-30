import express from 'express';
import { dataStore } from '../repositories/dataStore.js';

const router = express.Router();

// GET /api/command-center/summary - Live operational metrics for the Command Center
router.get('/summary', async (req, res, next) => {
  try {
    const cameras = await dataStore.getCameras();
    const activeCameras = cameras.filter(c => c.status === 'ACTIVE');
    
    const detections = await dataStore.getDetections({}, 100);
    const alerts = await dataStore.getAlerts({ status: 'OPEN' });
    const blacklist = await dataStore.getBlacklist();

    // Calculate unique vehicles
    const uniquePlates = new Set(detections.map(d => d.plateNumber));

    // Calculate average speed from detections with speed
    const speeds = detections.filter(d => typeof d.speed === 'number' && d.speed > 0).map(d => d.speed);
    const avgSpeed = speeds.length > 0 
      ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 
      : 48.5;

    // Traffic condition rating
    const congestionRatio = activeCameras.length > 0 ? (alerts.length / activeCameras.length) : 0;
    const trafficCondition = congestionRatio > 0.6 ? 'HEAVY CONGESTION' : congestionRatio > 0.2 ? 'MODERATE FLOW' : 'OPTIMAL FLOW';

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalCameras: cameras.length,
        activeCameras: activeCameras.length,
        inactiveCameras: cameras.length - activeCameras.length,
        detectionsToday: detections.length,
        uniqueVehicles: uniquePlates.size,
        activeAlerts: alerts.length,
        blacklistedPlatesCount: blacklist.length,
        averageSpeedKmh: avgSpeed,
        networkHealthPercentage: cameras.length > 0 ? Math.round((activeCameras.length / cameras.length) * 100) : 100,
        trafficCondition
      },
      recentDetections: detections.slice(0, 15),
      recentAlerts: alerts.slice(0, 10),
      cameras
    });
  } catch (err) {
    next(err);
  }
});

export default router;
