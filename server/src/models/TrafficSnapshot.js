import mongoose from 'mongoose';

const TrafficSnapshotSchema = new mongoose.Schema({
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
  vehicleCount: { 
    type: Number, 
    default: 0 
  },
  densityLevel: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CONGESTED'], 
    default: 'LOW',
    index: true 
  },
  averageSpeed: { 
    type: Number, 
    default: 0 
  },
  timeWindowMinutes: { 
    type: Number, 
    default: 15 
  }
}, { 
  timestamps: true 
});

TrafficSnapshotSchema.index({ cameraId: 1, timestamp: -1 });

export default mongoose.models.TrafficSnapshot || mongoose.model('TrafficSnapshot', TrafficSnapshotSchema);
