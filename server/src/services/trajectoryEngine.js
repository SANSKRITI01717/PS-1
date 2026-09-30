import { dataStore } from '../repositories/dataStore.js';

/**
 * Haversine formula to calculate great-circle distance between two GPS coordinates in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371000; // Earth radius in meters
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

export class TrajectoryEngine {
  /**
   * Reconstruct the multi-camera chronological trajectory for a license plate
   * from actual database detections.
   */
  static async reconstructTrajectory(plateNumber) {
    const cleanPlate = plateNumber.toUpperCase().trim();

    // 1. Fetch all detections for this plate
    const rawDetections = await dataStore.getDetections({ plateNumber: cleanPlate }, 500);

    if (!rawDetections || rawDetections.length === 0) {
      return {
        success: true,
        plateNumber: cleanPlate,
        pointCount: 0,
        totalSightings: 0,
        uniqueCameras: 0,
        routeSequence: [],
        totalDistanceKm: 0,
        averageSpeedKmh: 0,
        trajectory: [],
        message: `No sightings recorded for vehicle '${cleanPlate}'.`
      };
    }

    // 2. Strict chronological ordering (handles out-of-order insertions)
    const sorted = [...rawDetections].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 3. Cache camera metadata for fast lookups
    const cameras = await dataStore.getCameras();
    const cameraMap = new Map();
    for (const cam of cameras) {
      cameraMap.set(cam.cameraId, cam);
      if (cam._id) cameraMap.set(String(cam._id), cam);
    }

    // 4. Collapse consecutive repeated sightings at the same camera
    // (e.g. A -> A -> A becomes one trajectory node at A with dwell time)
    const collapsedHops = [];
    let currentHop = null;

    for (const det of sorted) {
      const cam = cameraMap.get(det.cameraId) || {
        cameraId: det.cameraId,
        name: `Camera ${det.cameraId}`,
        location: 'City Road Network',
        coordinates: { lat: 28.4735, lng: 77.0812 },
        direction: det.direction || 'FORWARD'
      };

      const coords = cam.coordinates || { lat: 28.4735, lng: 77.0812 };
      const detTime = new Date(det.timestamp);

      if (!currentHop || currentHop.cameraId !== cam.cameraId) {
        if (currentHop) {
          collapsedHops.push(currentHop);
        }
        currentHop = {
          stepIndex: collapsedHops.length + 1,
          cameraId: cam.cameraId,
          cameraName: cam.name,
          location: cam.location,
          latitude: coords.lat,
          longitude: coords.lng,
          coordinates: { lat: coords.lat, lng: coords.lng },
          firstSeen: detTime.toISOString(),
          lastSeen: detTime.toISOString(),
          timestamp: detTime.toISOString(), // primary timestamp
          direction: det.direction || cam.direction || 'FORWARD',
          speed: det.speed || null,
          sightingCount: 1,
          confidence: det.confidence,
          detectionId: det._id
        };
      } else {
        // Consecutive sighting at same camera: update lastSeen and count
        currentHop.lastSeen = detTime.toISOString();
        currentHop.sightingCount += 1;
        // Keep highest confidence reading
        if (det.confidence > currentHop.confidence) {
          currentHop.confidence = det.confidence;
        }
      }
    }

    if (currentHop) {
      collapsedHops.push(currentHop);
    }

    // 5. Calculate segment distances, transit times, and hop speeds
    let totalDistanceMeters = 0;
    const trajectoryPoints = [];

    for (let i = 0; i < collapsedHops.length; i++) {
      const point = collapsedHops[i];
      point.stepIndex = i + 1;

      // Dwell time at this camera in seconds
      const dwellMs = new Date(point.lastSeen) - new Date(point.firstSeen);
      point.dwellTimeSeconds = Math.round(dwellMs / 1000);

      if (i > 0) {
        const prev = collapsedHops[i - 1];
        const dist = calculateDistanceMeters(prev.latitude, prev.longitude, point.latitude, point.longitude);
        totalDistanceMeters += dist;

        const transitSeconds = Math.max(1, Math.round((new Date(point.firstSeen) - new Date(prev.lastSeen)) / 1000));
        const speedKmh = transitSeconds > 0 ? (dist / transitSeconds) * 3.6 : 0;

        point.transitDistanceMeters = dist;
        point.transitTimeSeconds = transitSeconds;
        point.calculatedSpeedKmh = Math.round(speedKmh * 10) / 10;
        point.fromCameraId = prev.cameraId;
      } else {
        point.transitDistanceMeters = 0;
        point.transitTimeSeconds = 0;
        point.calculatedSpeedKmh = point.speed || 0;
      }

      trajectoryPoints.push(point);
    }

    // 6. Overall Summary Metrics
    const firstPoint = trajectoryPoints[0];
    const lastPoint = trajectoryPoints[trajectoryPoints.length - 1];
    const overallTimeSeconds = Math.max(1, Math.round((new Date(lastPoint.lastSeen) - new Date(firstPoint.firstSeen)) / 1000));
    const totalDistanceKm = Math.round((totalDistanceMeters / 1000) * 100) / 100;
    const avgSpeed = totalDistanceKm > 0 ? Math.round(((totalDistanceKm * 1000) / overallTimeSeconds) * 3.6 * 10) / 10 : 0;
    const uniqueCams = Array.from(new Set(trajectoryPoints.map(p => p.cameraId)));

    return {
      success: true,
      plateNumber: cleanPlate,
      totalSightings: rawDetections.length,
      pointCount: trajectoryPoints.length,
      uniqueCameras: uniqueCams.length,
      routeSequence: trajectoryPoints.map(p => p.cameraId),
      routePathString: trajectoryPoints.map(p => p.cameraName || p.cameraId).join(' → '),
      startTime: firstPoint.firstSeen,
      endTime: lastPoint.lastSeen,
      totalDurationSeconds: overallTimeSeconds,
      totalDistanceKm,
      averageSpeedKmh: avgSpeed,
      trajectory: trajectoryPoints
    };
  }
}
