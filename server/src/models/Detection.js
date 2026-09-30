import mongoose from 'mongoose';

const DetectionSchema = new mongoose.Schema({
  plateNumber: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true,
    index: true 
  },
  confidence: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 1 
  },
  cameraId: { 
    type: String, 
    required: true, 
    index: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  imagePath: { 
    type: String, 
    default: '' 
  },
  bbox: {
    x1: { type: Number, default: 0 },
    y1: { type: Number, default: 0 },
    x2: { type: Number, default: 0 },
    y2: { type: Number, default: 0 }
  },
  direction: { 
    type: String, 
    default: 'FORWARD' 
  },
  speed: { 
    type: Number, 
    default: null 
  },
  vehicleType: { 
    type: String, 
    default: 'CAR' 
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  }
}, { 
  timestamps: true 
});

// High performance compound indexes for fast trajectory and camera timeline lookups
DetectionSchema.index({ plateNumber: 1, timestamp: -1 });
DetectionSchema.index({ cameraId: 1, timestamp: -1 });

export default mongoose.models.Detection || mongoose.model('Detection', DetectionSchema);
