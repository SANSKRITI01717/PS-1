import mongoose from 'mongoose';

const RouteSegmentSchema = new mongoose.Schema({
  segmentId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  fromCameraId: { 
    type: String, 
    required: true, 
    index: true 
  },
  toCameraId: { 
    type: String, 
    required: true, 
    index: true 
  },
  fromCoordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  toCoordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  distanceMeters: { 
    type: Number, 
    default: 1000 
  },
  averageTravelTimeSeconds: { 
    type: Number, 
    default: 120 
  },
  vehicleCount: { 
    type: Number, 
    default: 0 
  },
  currentDensity: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CONGESTED'], 
    default: 'LOW' 
  }
}, { 
  timestamps: true 
});

export default mongoose.models.RouteSegment || mongoose.model('RouteSegment', RouteSegmentSchema);
