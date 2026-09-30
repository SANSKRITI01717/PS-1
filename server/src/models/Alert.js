import mongoose from 'mongoose';

const AlertSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['BLACKLIST_MATCH', 'SPEED_VIOLATION', 'SUSPICIOUS_ROUTE', 'CONGESTION_ALERT', 'CAMERA_OFFLINE'], 
    required: true,
    index: true 
  },
  severity: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 
    default: 'HIGH',
    index: true 
  },
  plateNumber: { 
    type: String, 
    uppercase: true, 
    trim: true,
    index: true,
    default: null
  },
  cameraId: { 
    type: String, 
    required: true, 
    index: true 
  },
  location: { 
    type: String, 
    default: 'City Sector' 
  },
  coordinates: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },
  message: { 
    type: String, 
    required: true 
  },
  detectionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Detection',
    default: null
  },
  status: { 
    type: String, 
    enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'], 
    default: 'OPEN',
    index: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  resolvedAt: { 
    type: Date, 
    default: null 
  },
  resolvedBy: { 
    type: String, 
    default: null 
  }
}, { 
  timestamps: true 
});

AlertSchema.index({ status: 1, timestamp: -1 });

export default mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
