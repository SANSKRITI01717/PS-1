import express from 'express';
import { AnalyticsEngine } from '../services/analyticsEngine.js';

const router = express.Router();

// GET /api/analytics/traffic - Overall summary, hourly & daily trends, vehicle counts
router.get('/traffic', async (req, res, next) => {
  try {
    const data = await AnalyticsEngine.getTrafficSummary();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/density - Camera-wise traffic density & capacity utilization
router.get('/density', async (req, res, next) => {
  try {
    const data = await AnalyticsEngine.getDensityAnalytics();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/routes - Route density connecting consecutive camera pairs
router.get('/routes', async (req, res, next) => {
  try {
    const data = await AnalyticsEngine.getRouteDensity();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/speed - Average speed estimation, corridor velocities, violations
router.get('/speed', async (req, res, next) => {
  try {
    const data = await AnalyticsEngine.getSpeedAnalytics();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/origin-destination - Origin-Destination (O-D) matrix analysis
router.get('/origin-destination', async (req, res, next) => {
  try {
    const data = await AnalyticsEngine.getOriginDestinationAnalysis();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/congestion - Congestion bottleneck detection and delays
router.get('/congestion', async (req, res, next) => {
  try {
    const data = await AnalyticsEngine.getCongestionAnalytics();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
