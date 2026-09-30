import { dataStore } from '../repositories/dataStore.js';

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export class AnalyticsEngine {
  /**
   * 1. Overall Traffic Summary, Hourly & Daily Trends, Vehicle Counts
   */
  static async getTrafficSummary() {
    const detections = await dataStore.getDetections({}, 1000);
    const cameras = await dataStore.getCameras();

    if (detections.length === 0) {
      return {
        success: true,
        insufficientData: true,
        message: 'Insufficient data: No vehicle detections recorded yet.',
        totalDetections: 0,
        uniqueVehicles: 0
      };
    }

    // Unique vehicles
    const plateSet = new Set();
    const vehicleTypeCounts = {};

    // 24-hour histogram
    const hourlyCounts = Array(24).fill(0);
    // 7-day histogram
    const dailyMap = new Map();

    for (const d of detections) {
      plateSet.add(d.plateNumber);

      const vType = d.vehicleType || 'CAR';
      vehicleTypeCounts[vType] = (vehicleTypeCounts[vType] || 0) + 1;

      const dateObj = new Date(d.timestamp);
      const hour = dateObj.getHours();
      hourlyCounts[hour]++;

      const dayKey = dateObj.toISOString().split('T')[0];
      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
    }

    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Peak hour calculation
    let peakHour = 0;
    let maxHourCount = 0;
    hourlyCounts.forEach((count, h) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = h;
      }
    });

    return {
      success: true,
      insufficientData: false,
      totalDetections: detections.length,
      uniqueVehicles: plateSet.size,
      peakTrafficHour: `${String(peakHour).padStart(2, '0')}:00 - ${String((peakHour + 1) % 24).padStart(2, '0')}:00`,
      peakHourCount: maxHourCount,
      vehicleTypeBreakdown: vehicleTypeCounts,
      hourlyTrends: hourlyCounts.map((count, hour) => ({
        hour: `${String(hour).padStart(2, '0')}:00`,
        count
      })),
      dailyTrends
    };
  }

  /**
   * 2. Traffic Density per Camera Junction
   */
  static async getDensityAnalytics() {
    const cameras = await dataStore.getCameras();
    const detections = await dataStore.getDetections({}, 1000);

    if (cameras.length === 0) {
      return {
        success: true,
        insufficientData: true,
        message: 'Insufficient data: No surveillance cameras registered.'
      };
    }

    // Count detections per camera
    const cameraCounts = new Map();
    for (const d of detections) {
      cameraCounts.set(d.cameraId, (cameraCounts.get(d.cameraId) || 0) + 1);
    }

    const CAPACITY_BENCHMARK = 30; // standard camera design threshold for baseline
    const cameraDensity = cameras.map(cam => {
      const count = cameraCounts.get(cam.cameraId) || 0;
      const utilization = Math.min(100, Math.round((count / CAPACITY_BENCHMARK) * 100));

      let densityLevel = 'LOW';
      if (utilization >= 80) densityLevel = 'CONGESTED';
      else if (utilization >= 55) densityLevel = 'HIGH';
      else if (utilization >= 30) densityLevel = 'MEDIUM';

      return {
        cameraId: cam.cameraId,
        cameraName: cam.name,
        location: cam.location,
        coordinates: cam.coordinates,
        detectionCount: count,
        densityLevel,
        capacityUtilizationPercentage: utilization,
        status: cam.status
      };
    });

    return {
      success: true,
      insufficientData: false,
      totalCamerasEvaluated: cameras.length,
      averageUtilization: Math.round(
        cameraDensity.reduce((acc, c) => acc + c.capacityUtilizationPercentage, 0) / cameras.length
      ),
      densityRanking: cameraDensity.sort((a, b) => b.detectionCount - a.detectionCount)
    };
  }

  /**
   * 3. Route Density across Inter-Camera Road Segments
   */
  static async getRouteDensity() {
    const detections = await dataStore.getDetections({}, 1000);
    const cameras = await dataStore.getCameras();
    const cameraMap = new Map(cameras.map(c => [c.cameraId, c]));

    // Group detections by plate ordered chronologically
    const plateDetections = new Map();
    for (const d of detections) {
      if (!plateDetections.has(d.plateNumber)) {
        plateDetections.set(d.plateNumber, []);
      }
      plateDetections.get(d.plateNumber).push(d);
    }

    const segmentMap = new Map(); // "FROM_TO" -> { count, totalTimeSec, ... }

    for (const [plate, dets] of plateDetections.entries()) {
      const sorted = [...dets].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Collapse identical consecutive camera detections
      const collapsed = [];
      for (const d of sorted) {
        if (collapsed.length === 0 || collapsed[collapsed.length - 1].cameraId !== d.cameraId) {
          collapsed.push(d);
        }
      }

      for (let i = 1; i < collapsed.length; i++) {
        const fromCam = collapsed[i - 1];
        const toCam = collapsed[i];
        if (fromCam.cameraId === toCam.cameraId) continue;

        const segKey = `${fromCam.cameraId}__${toCam.cameraId}`;
        const dtSec = Math.max(1, Math.round((new Date(toCam.timestamp) - new Date(fromCam.timestamp)) / 1000));

        if (!segmentMap.has(segKey)) {
          const c1 = cameraMap.get(fromCam.cameraId);
          const c2 = cameraMap.get(toCam.cameraId);
          const dist = c1 && c2 && c1.coordinates && c2.coordinates
            ? calculateDistanceMeters(c1.coordinates.lat, c1.coordinates.lng, c2.coordinates.lat, c2.coordinates.lng)
            : 1500;

          segmentMap.set(segKey, {
            segmentId: segKey,
            fromCameraId: fromCam.cameraId,
            fromCameraName: c1 ? c1.name : fromCam.cameraId,
            fromCoordinates: c1 ? c1.coordinates : null,
            toCameraId: toCam.cameraId,
            toCameraName: c2 ? c2.name : toCam.cameraId,
            toCoordinates: c2 ? c2.coordinates : null,
            distanceMeters: dist,
            vehicleCount: 0,
            totalTransitTimeSeconds: 0
          });
        }

        const seg = segmentMap.get(segKey);
        seg.vehicleCount += 1;
        seg.totalTransitTimeSeconds += dtSec;
      }
    }

    if (segmentMap.size === 0) {
      return {
        success: true,
        insufficientData: true,
        message: 'Insufficient multi-camera transit data to establish route density.',
        segments: []
      };
    }

    const segments = Array.from(segmentMap.values()).map(s => {
      const avgDuration = Math.round(s.totalTransitTimeSeconds / s.vehicleCount);
      const avgSpeed = avgDuration > 0 ? Math.round(((s.distanceMeters / avgDuration) * 3.6) * 10) / 10 : 0;
      let density = 'LOW';
      if (s.vehicleCount >= 5) density = 'HIGH';
      else if (s.vehicleCount >= 3) density = 'MEDIUM';

      return {
        ...s,
        averageTravelTimeSeconds: avgDuration,
        averageSpeedKmh: avgSpeed,
        densityLevel: density
      };
    }).sort((a, b) => b.vehicleCount - a.vehicleCount);

    return {
      success: true,
      insufficientData: false,
      totalRouteSegmentsIdentified: segments.length,
      busiestCorridor: segments[0] ? `${segments[0].fromCameraName} → ${segments[0].toCameraName}` : 'N/A',
      segments
    };
  }

  /**
   * 4. Average Speed Estimation and Speed Violations
   */
  static async getSpeedAnalytics() {
    const routeData = await this.getRouteDensity();
    if (routeData.insufficientData || routeData.segments.length === 0) {
      return {
        success: true,
        insufficientData: true,
        message: 'Insufficient data: Need at least 2 consecutive camera detections to compute transit speeds.'
      };
    }

    const speeds = [];
    const SPEED_LIMIT = 60.0; // standard urban expressway limit
    let speedViolations = 0;

    for (const s of routeData.segments) {
      if (s.averageSpeedKmh > 0) {
        speeds.push(s.averageSpeedKmh);
        if (s.averageSpeedKmh > SPEED_LIMIT) {
          speedViolations += s.vehicleCount;
        }
      }
    }

    if (speeds.length === 0) {
      return {
        success: true,
        insufficientData: true,
        message: 'Insufficient data: Unable to calculate velocities.'
      };
    }

    const sortedSpeeds = [...speeds].sort((a, b) => a - b);
    const avgSpeed = Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10;
    const medianSpeed = sortedSpeeds[Math.floor(sortedSpeeds.length / 2)];

    return {
      success: true,
      insufficientData: false,
      overallAverageSpeedKmh: avgSpeed,
      medianSpeedKmh: medianSpeed,
      minCorridorSpeedKmh: sortedSpeeds[0],
      maxCorridorSpeedKmh: sortedSpeeds[sortedSpeeds.length - 1],
      speedLimitThresholdKmh: SPEED_LIMIT,
      speedViolationsCount: speedViolations,
      corridorSpeeds: routeData.segments.map(s => ({
        corridor: `${s.fromCameraId} → ${s.toCameraId}`,
        name: `${s.fromCameraName} → ${s.toCameraName}`,
        averageSpeedKmh: s.averageSpeedKmh,
        transitDistanceMeters: s.distanceMeters,
        travelTimeSeconds: s.averageTravelTimeSeconds
      }))
    };
  }

  /**
   * 5. Origin-Destination (O-D) Matrix Analysis
   */
  static async getOriginDestinationAnalysis() {
    const detections = await dataStore.getDetections({}, 1000);
    const cameras = await dataStore.getCameras();
    const cameraMap = new Map(cameras.map(c => [c.cameraId, c]));

    // Group by vehicle plate
    const vehicleTrips = new Map();
    for (const d of detections) {
      if (!vehicleTrips.has(d.plateNumber)) {
        vehicleTrips.set(d.plateNumber, []);
      }
      vehicleTrips.get(d.plateNumber).push(d);
    }

    const odMatrix = new Map(); // "ORIGIN__DEST" -> count

    for (const [plate, dets] of vehicleTrips.entries()) {
      if (dets.length < 2) continue;
      const sorted = [...dets].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const origin = sorted[0];
      const destination = sorted[sorted.length - 1];

      if (origin.cameraId === destination.cameraId) continue;

      const odKey = `${origin.cameraId}__${destination.cameraId}`;
      if (!odMatrix.has(odKey)) {
        const c1 = cameraMap.get(origin.cameraId);
        const c2 = cameraMap.get(destination.cameraId);
        const dist = c1 && c2 && c1.coordinates && c2.coordinates
          ? calculateDistanceMeters(c1.coordinates.lat, c1.coordinates.lng, c2.coordinates.lat, c2.coordinates.lng)
          : 2000;

        odMatrix.set(odKey, {
          originId: origin.cameraId,
          originName: c1 ? c1.name : origin.cameraId,
          destinationId: destination.cameraId,
          destinationName: c2 ? c2.name : destination.cameraId,
          tripCount: 0,
          totalTransitDurationSeconds: 0,
          distanceMeters: dist
        });
      }

      const odItem = odMatrix.get(odKey);
      odItem.tripCount += 1;
      odItem.totalTransitDurationSeconds += Math.max(1, Math.round((new Date(destination.timestamp) - new Date(origin.timestamp)) / 1000));
    }

    if (odMatrix.size === 0) {
      return {
        success: true,
        insufficientData: true,
        message: 'Insufficient data: Need vehicles with at least 2 distinct camera sightings to formulate O-D trips.',
        odPairs: []
      };
    }

    const odPairs = Array.from(odMatrix.values()).map(od => ({
      ...od,
      averageTripDurationMinutes: Math.round((od.totalTransitDurationSeconds / od.tripCount / 60) * 10) / 10
    })).sort((a, b) => b.tripCount - a.tripCount);

    return {
      success: true,
      insufficientData: false,
      totalODTripsAnalyzed: odPairs.reduce((a, b) => a + b.tripCount, 0),
      topOriginDestinationCorridor: odPairs[0] ? `${odPairs[0].originName} → ${odPairs[0].destinationName}` : 'N/A',
      odPairs
    };
  }

  /**
   * 6. Congestion Detection & Bottleneck Alerts
   */
  static async getCongestionAnalytics() {
    const routeData = await this.getRouteDensity();
    const densityData = await this.getDensityAnalytics();

    if (routeData.insufficientData || densityData.insufficientData) {
      return {
        success: true,
        insufficientData: true,
        message: 'Insufficient data to compute congestion bottleneck analysis.',
        congestedCorridors: [],
        congestedJunctions: []
      };
    }

    // Corridors with low speed (< 25 km/h) or high density
    const congestedCorridors = routeData.segments
      .filter(s => s.averageSpeedKmh < 25 || s.densityLevel === 'HIGH' || s.densityLevel === 'CONGESTED')
      .map(s => {
        let severity = 'MILD';
        if (s.averageSpeedKmh < 15) severity = 'SEVERE';
        else if (s.averageSpeedKmh < 22) severity = 'MODERATE';

        return {
          corridorId: s.segmentId,
          corridorName: `${s.fromCameraName} → ${s.toCameraName}`,
          averageSpeedKmh: s.averageSpeedKmh,
          vehicleVolume: s.vehicleCount,
          severity,
          estimatedDelayMinutes: Math.max(1, Math.round((s.averageTravelTimeSeconds - (s.distanceMeters / (45 / 3.6))) / 60))
        };
      });

    // Junctions with high utilization
    const congestedJunctions = densityData.densityRanking
      .filter(c => c.densityLevel === 'HIGH' || c.densityLevel === 'CONGESTED')
      .map(c => ({
        cameraId: c.cameraId,
        junctionName: c.cameraName,
        location: c.location,
        coordinates: c.coordinates,
        capacityUtilizationPercentage: c.capacityUtilizationPercentage,
        densityLevel: c.densityLevel
      }));

    return {
      success: true,
      insufficientData: false,
      cityCongestionStatus: congestedCorridors.length > 0 ? 'CONGESTION_DETECTED' : 'CLEAR_FLOW',
      totalCongestedCorridors: congestedCorridors.length,
      totalCongestedJunctions: congestedJunctions.length,
      congestedCorridors,
      congestedJunctions
    };
  }
}
