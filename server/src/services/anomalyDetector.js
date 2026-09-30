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

export class AnomalyDetector {
  /**
   * Evaluate a newly recorded detection for suspicious route anomalies
   */
  static async evaluateDetection(newDetection, io = null) {
    const plate = newDetection.plateNumber.toUpperCase();

    // Fetch previous detections for this plate in chronological order
    const history = await dataStore.getDetections({ plateNumber: plate }, 10);
    if (!history || history.length < 2) return null;

    const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const current = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];

    if (current.cameraId === previous.cameraId) {
      return null; // Same camera is handled by dwell time
    }

    const cameras = await dataStore.getCameras();
    const c1 = cameras.find(c => c.cameraId === previous.cameraId);
    const c2 = cameras.find(c => c.cameraId === current.cameraId);

    if (!c1 || !c2 || !c1.coordinates || !c2.coordinates) return null;

    const distMeters = calculateDistanceMeters(
      c1.coordinates.lat, c1.coordinates.lng,
      c2.coordinates.lat, c2.coordinates.lng
    );

    const dtSeconds = Math.max(1, Math.round((new Date(current.timestamp) - new Date(previous.timestamp)) / 1000));
    const speedKmh = Math.round(((distMeters / dtSeconds) * 3.6) * 10) / 10;

    // Rule 1: Physically Implausible Rapid Transition / Cloned Plate Anomaly
    // If distance > 1000m and speed > 150 km/h or transit time < 15 seconds
    if (distMeters >= 1000 && (speedKmh > 140 || dtSeconds < 15)) {
      const alert = await dataStore.createAlert({
        type: 'SUSPICIOUS_ROUTE',
        severity: 'CRITICAL',
        plateNumber: plate,
        cameraId: current.cameraId,
        location: `${c1.name} → ${c2.name}`,
        coordinates: c2.coordinates,
        message: `ANOMALY ALERT: Physically implausible transit detected for ${plate}. Covered ${distMeters}m in ${dtSeconds}s (Est. Speed: ${speedKmh} km/h). Possible cloned plate or extreme speeding.`
      });

      if (io) {
        io.emit('alert:new', alert);
      }
      return alert;
    }

    // Rule 2: Excessive Urban Speed Violation (> 100 km/h)
    if (speedKmh > 100) {
      const alert = await dataStore.createAlert({
        type: 'SPEED_VIOLATION',
        severity: 'HIGH',
        plateNumber: plate,
        cameraId: current.cameraId,
        location: `${c1.name} → ${c2.name}`,
        coordinates: c2.coordinates,
        message: `SPEED ALERT: Vehicle ${plate} exceeded urban velocity limit on corridor ${c1.cameraId} → ${c2.cameraId} (${speedKmh} km/h vs limit 60 km/h).`
      });

      if (io) {
        io.emit('alert:new', alert);
      }
      return alert;
    }

    // Rule 3: Abnormal Oscillating Loop (A -> B -> A within 3 minutes)
    if (sorted.length >= 3) {
      const p2 = sorted[sorted.length - 3];
      if (p2.cameraId === current.cameraId && previous.cameraId !== current.cameraId) {
        const loopDt = Math.round((new Date(current.timestamp) - new Date(p2.timestamp)) / 1000);
        if (loopDt < 180) {
          const alert = await dataStore.createAlert({
            type: 'SUSPICIOUS_ROUTE',
            severity: 'MEDIUM',
            plateNumber: plate,
            cameraId: current.cameraId,
            location: c2.location,
            coordinates: c2.coordinates,
            message: `SUSPICIOUS ROUTE: Rapid oscillatory loop detected for ${plate}. Returned to ${c2.name} in ${loopDt}s.`
          });

          if (io) {
            io.emit('alert:new', alert);
          }
          return alert;
        }
      }
    }

    return null;
  }
}
