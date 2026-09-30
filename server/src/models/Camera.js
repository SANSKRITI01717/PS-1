import mongoose from 'mongoose';

const CameraSchema = new mongoose.Schema({
  cameraId: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  location: { 
    type: String, 
    required: true, 
    trim: true 
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ERROR'], 
    default: 'ACTIVE',
    index: true
  },
  feedType: { 
    type: String, 
    enum: ['RTSP', 'HTTP', 'VIDEO_FILE', 'IMAGE_FEED', 'SIMULATED'], 
    default: 'SIMULATED' 
  },
  streamUrl: { 
    type: String, 
    default: '' 
  },
  fps: { 
    type: Number, 
    default: 25 
  },
  direction: { 
    type: String, 
    default: 'NORTHBOUND' 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now 
  },
  detectionCount: { 
    type: Number, 
    default: 0 
  }
}, { 
  timestamps: true 
});

CameraSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

export default mongoose.models.Camera || mongoose.model('Camera', CameraSchema);
