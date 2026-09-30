import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Camera from '../models/Camera.js';
import Detection from '../models/Detection.js';
import Vehicle from '../models/Vehicle.js';
import TrajectoryEvent from '../models/TrajectoryEvent.js';
import Blacklist from '../models/Blacklist.js';
import Alert from '../models/Alert.js';
import TrafficSnapshot from '../models/TrafficSnapshot.js';
import RouteSegment from '../models/RouteSegment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'resilient_store.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial realistic seed cameras for City-Wide ANPR
const INITIAL_CAMERAS = [
  {
    cameraId: 'CAM-IND-01',
    name: 'MG Road Junction Terminal',
    location: 'Sector 14 - MG Road Intersect',
    coordinates: { lat: 28.4735, lng: 77.0812 },
    status: 'ACTIVE',
    feedType: 'SIMULATED',
    direction: 'NORTHBOUND',
    detectionCount: 14
  },
  {
    cameraId: 'CAM-IND-02',
    name: 'Cyber City Hub Gate 3',
    location: 'Cyber Hub Rapid Transit Way',
    coordinates: { lat: 28.4905, lng: 77.0898 },
    status: 'ACTIVE',
    feedType: 'SIMULATED',
    direction: 'EASTBOUND',
    detectionCount: 22
  },
  {
    cameraId: 'CAM-IND-03',
    name: 'Golf Course Road Flyover',
    location: 'Golf Course Road Sector 42',
    coordinates: { lat: 28.4623, lng: 77.0984 },
    status: 'ACTIVE',
    feedType: 'SIMULATED',
    direction: 'SOUTHBOUND',
    detectionCount: 9
  },
  {
    cameraId: 'CAM-IND-04',
    name: 'IFFCO Chowk Expressway Ingress',
    location: 'NH-48 Interchange Expressway',
    coordinates: { lat: 28.4789, lng: 77.0543 },
    status: 'ACTIVE',
    feedType: 'SIMULATED',
    direction: 'WESTBOUND',
    detectionCount: 31
  },
  {
    cameraId: 'CAM-IND-05',
    name: 'Railway Junction Outer Gate',
    location: 'Old City Station Road',
    coordinates: { lat: 28.4550, lng: 77.0315 },
    status: 'ACTIVE',
    feedType: 'SIMULATED',
    direction: 'NORTHBOUND',
    detectionCount: 18
  }
];

class ResilientDataStore {
  constructor() {
    this.memory = {
      cameras: [],
      detections: [],
      vehicles: [],
      trajectoryEvents: [],
      blacklist: [],
      alerts: [],
      trafficSnapshots: [],
      routeSegments: []
    };
    this.loadFromFile();
    if (this.memory.cameras.length === 0) {
      this.memory.cameras = INITIAL_CAMERAS.map(c => ({
        ...c,
        _id: 'cam_' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      }));
      this.saveToFile();
    }
  }

  isMongoReady() {
    return mongoose.connection.readyState === 1;
  }

  loadFromFile() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        this.memory = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DataStore] Failed to load local store file:', e.message);
    }
  }

  saveToFile() {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.memory, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[DataStore] Failed to persist store to file:', e.message);
    }
  }

  // --- CAMERAS ---
  async getCameras(filter = {}) {
    if (this.isMongoReady()) {
      return await Camera.find(filter).sort({ createdAt: -1 });
    }
    return this.memory.cameras.filter(c => {
      for (const [k, v] of Object.entries(filter)) {
        if (c[k] !== v) return false;
      }
      return true;
    });
  }

  async getCameraById(id) {
    if (this.isMongoReady()) {
      return (await Camera.findById(id).catch(() => null)) || (await Camera.findOne({ cameraId: id }));
    }
    return this.memory.cameras.find(c => c._id === id || c.cameraId === id) || null;
  }

  async createCamera(cameraData) {
    if (this.isMongoReady()) {
      return await Camera.create(cameraData);
    }
    const newCam = {
      ...cameraData,
      _id: 'cam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      detectionCount: cameraData.detectionCount || 0,
      status: cameraData.status || 'ACTIVE',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.memory.cameras.push(newCam);
    this.saveToFile();
    return newCam;
  }

  async updateCamera(id, updateData) {
    if (this.isMongoReady()) {
      return await Camera.findOneAndUpdate(
        { $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { cameraId: id }] },
        updateData,
        { new: true }
      );
    }
    const idx = this.memory.cameras.findIndex(c => c._id === id || c.cameraId === id);
    if (idx === -1) return null;
    this.memory.cameras[idx] = {
      ...this.memory.cameras[idx],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    this.saveToFile();
    return this.memory.cameras[idx];
  }

  async deleteCamera(id) {
    if (this.isMongoReady()) {
      return await Camera.findOneAndDelete(
        { $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { cameraId: id }] }
      );
    }
    const idx = this.memory.cameras.findIndex(c => c._id === id || c.cameraId === id);
    if (idx === -1) return null;
    const removed = this.memory.cameras.splice(idx, 1)[0];
    this.saveToFile();
    return removed;
  }

  // --- DETECTIONS ---
  async getDetections(filter = {}, limit = 50) {
    if (this.isMongoReady()) {
      return await Detection.find(filter).sort({ timestamp: -1 }).limit(limit);
    }
    return this.memory.detections
      .filter(d => {
        for (const [k, v] of Object.entries(filter)) {
          if (d[k] !== v) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getDetectionById(id) {
    if (this.isMongoReady()) {
      return await Detection.findById(id).catch(() => null);
    }
    return this.memory.detections.find(d => d._id === id) || null;
  }

  async createDetection(detectionData) {
    // 1. Save Detection
    let savedDetection;
    if (this.isMongoReady()) {
      savedDetection = await Detection.create(detectionData);
    } else {
      savedDetection = {
        ...detectionData,
        _id: 'det_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: detectionData.timestamp ? new Date(detectionData.timestamp).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.memory.detections.push(savedDetection);
    }

    // 2. Update Camera detection count & last seen
    const camera = await this.getCameraById(detectionData.cameraId);
    if (camera) {
      await this.updateCamera(camera.cameraId || camera._id, {
        lastSeen: new Date().toISOString(),
        detectionCount: (camera.detectionCount || 0) + 1
      });
    }

    // 3. Upsert Vehicle
    const plate = detectionData.plateNumber.toUpperCase();
    await this.upsertVehicleFromDetection(plate, detectionData);

    // 4. Record Trajectory Event
    if (camera && camera.coordinates) {
      await this.createTrajectoryEvent({
        vehiclePlate: plate,
        cameraId: camera.cameraId,
        cameraName: camera.name,
        timestamp: savedDetection.timestamp,
        coordinates: camera.coordinates,
        direction: detectionData.direction || camera.direction || 'FORWARD',
        speed: detectionData.speed || null,
        detectionId: savedDetection._id
      });
    }

    // 5. Check Blacklist & trigger Alert if flagged
    const blacklistHit = await this.checkBlacklist(plate);
    if (blacklistHit) {
      const alertObj = await this.createAlert({
        type: 'BLACKLIST_MATCH',
        severity: blacklistHit.severity || 'CRITICAL',
        plateNumber: plate,
        cameraId: detectionData.cameraId,
        location: camera ? camera.location : 'Detected Camera Sector',
        coordinates: camera ? camera.coordinates : { lat: 0, lng: 0 },
        message: `ALERT: Blacklisted vehicle ${plate} spotted at ${camera ? camera.name : detectionData.cameraId}. Reason: ${blacklistHit.reason}`,
        detectionId: savedDetection._id,
        timestamp: savedDetection.timestamp
      });
      savedDetection.alertTriggered = alertObj;
    }

    this.saveToFile();

    return savedDetection;
  }

  async upsertVehicleFromDetection(plate, detectionData) {
    if (this.isMongoReady()) {
      return await Vehicle.findOneAndUpdate(
        { plateNumber: plate },
        { 
          $set: { lastSeen: new Date(), ...(detectionData.vehicleType ? { vehicleType: detectionData.vehicleType } : {}) },
          $inc: { totalDetections: 1 },
          $setOnInsert: { firstSeen: new Date(), plateNumber: plate }
        },
        { upsert: true, new: true }
      );
    }

    let v = this.memory.vehicles.find(item => item.plateNumber === plate);
    if (v) {
      v.lastSeen = new Date().toISOString();
      v.totalDetections = (v.totalDetections || 1) + 1;
      if (detectionData.vehicleType) v.vehicleType = detectionData.vehicleType;
    } else {
      v = {
        _id: 'veh_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        plateNumber: plate,
        vehicleType: detectionData.vehicleType || 'CAR',
        makeModel: 'UNKNOWN',
        color: 'UNKNOWN',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        totalDetections: 1,
        isBlacklisted: false,
        flagReason: ''
      };
      this.memory.vehicles.push(v);
    }
    return v;
  }

  // --- TRAJECTORY EVENTS ---
  async createTrajectoryEvent(eventData) {
    if (this.isMongoReady()) {
      return await TrajectoryEvent.create(eventData);
    }
    const event = {
      ...eventData,
      _id: 'traj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date(eventData.timestamp).toISOString(),
      createdAt: new Date().toISOString()
    };
    this.memory.trajectoryEvents.push(event);
    return event;
  }

  async getTrajectoryForPlate(plate) {
    const uppercasePlate = plate.toUpperCase();
    if (this.isMongoReady()) {
      return await TrajectoryEvent.find({ vehiclePlate: uppercasePlate }).sort({ timestamp: 1 });
    }
    return this.memory.trajectoryEvents
      .filter(t => t.vehiclePlate === uppercasePlate)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // --- VEHICLE HISTORY ---
  async getVehicleHistory(plate) {
    const uppercasePlate = plate.toUpperCase();
    const vehicle = this.isMongoReady() 
      ? await Vehicle.findOne({ plateNumber: uppercasePlate })
      : this.memory.vehicles.find(v => v.plateNumber === uppercasePlate) || null;

    const detections = await this.getDetections({ plateNumber: uppercasePlate }, 100);
    const trajectory = await this.getTrajectoryForPlate(uppercasePlate);
    const blacklist = await this.checkBlacklist(uppercasePlate);

    return {
      plateNumber: uppercasePlate,
      vehicleProfile: vehicle || {
        plateNumber: uppercasePlate,
        status: 'AUTO_DISCOVERED',
        totalDetections: detections.length
      },
      isBlacklisted: !!blacklist,
      blacklistDetails: blacklist || null,
      totalSightings: detections.length,
      detections,
      trajectory
    };
  }

  // --- BLACKLIST ---
  async getBlacklist() {
    if (this.isMongoReady()) {
      return await Blacklist.find().sort({ createdAt: -1 });
    }
    return [...this.memory.blacklist].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async checkBlacklist(plate) {
    const uppercasePlate = plate.toUpperCase();
    if (this.isMongoReady()) {
      return await Blacklist.findOne({ plateNumber: uppercasePlate, isActive: true });
    }
    return this.memory.blacklist.find(b => b.plateNumber === uppercasePlate && b.isActive !== false) || null;
  }

  async addToBlacklist(blacklistData) {
    const plate = blacklistData.plateNumber.toUpperCase();
    if (this.isMongoReady()) {
      return await Blacklist.findOneAndUpdate(
        { plateNumber: plate },
        { ...blacklistData, plateNumber: plate, isActive: true },
        { upsert: true, new: true }
      );
    }
    const idx = this.memory.blacklist.findIndex(b => b.plateNumber === plate);
    const record = {
      ...blacklistData,
      _id: idx >= 0 ? this.memory.blacklist[idx]._id : 'blk_' + Date.now(),
      plateNumber: plate,
      severity: blacklistData.severity || 'HIGH',
      isActive: true,
      createdAt: idx >= 0 ? this.memory.blacklist[idx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      this.memory.blacklist[idx] = record;
    } else {
      this.memory.blacklist.push(record);
    }
    this.saveToFile();
    return record;
  }

  // --- ALERTS ---
  async getAlerts(filter = {}) {
    if (this.isMongoReady()) {
      return await Alert.find(filter).sort({ timestamp: -1 });
    }
    return this.memory.alerts
      .filter(a => {
        for (const [k, v] of Object.entries(filter)) {
          if (a[k] !== v) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async createAlert(alertData) {
    let savedAlert;
    if (this.isMongoReady()) {
      savedAlert = await Alert.create(alertData);
    } else {
      savedAlert = {
        ...alertData,
        _id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        status: alertData.status || 'OPEN',
        timestamp: alertData.timestamp ? new Date(alertData.timestamp).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      this.memory.alerts.push(savedAlert);
      this.saveToFile();
    }
    return savedAlert;
  }

  async updateAlertStatus(id, status, resolvedBy = 'Command Center Operator') {
    if (this.isMongoReady()) {
      return await Alert.findByIdAndUpdate(
        id,
        {
          status,
          ...(status === 'RESOLVED' ? { resolvedAt: new Date(), resolvedBy } : {})
        },
        { new: true }
      );
    }
    const alert = this.memory.alerts.find(a => a._id === id);
    if (!alert) return null;
    alert.status = status;
    if (status === 'RESOLVED') {
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = resolvedBy;
    }
    this.saveToFile();
    return alert;
  }

  async deleteBlacklist(plate) {
    const uppercase = plate.toUpperCase().trim();
    if (this.isMongoReady()) {
      return await Blacklist.findOneAndDelete({ plateNumber: uppercase });
    }
    const idx = this.memory.blacklist.findIndex(b => b.plateNumber === uppercase);
    if (idx === -1) return null;
    const removed = this.memory.blacklist.splice(idx, 1)[0];
    this.saveToFile();
    return removed;
  }

  async updateBlacklistStatus(plate, isActive) {
    const uppercase = plate.toUpperCase().trim();
    if (this.isMongoReady()) {
      return await Blacklist.findOneAndUpdate(
        { plateNumber: uppercase },
        { isActive, updatedAt: new Date() },
        { new: true }
      );
    }
    const item = this.memory.blacklist.find(b => b.plateNumber === uppercase);
    if (!item) return null;
    item.isActive = isActive;
    item.updatedAt = new Date().toISOString();
    this.saveToFile();
    return item;
  }
}


export const dataStore = new ResilientDataStore();
