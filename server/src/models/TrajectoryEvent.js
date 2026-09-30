import mongoose from 'mongoose';

const TrajectoryEventSchema = new mongoose.Schema({
  vehiclePlate: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true,
    index: true 
  },
  cameraId: { 
    type: String, 
    required: true, 
    index: true 
  },
  cameraName: { 
    type: String, 
    default: '' 
  },
  timestamp: { 
    type: Date, 
    required: true, 
    index: true 
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  direction: { 
    type: String, 
    default: 'FORWARD' 
  },
  speed: { 
    type: Number, 
    default: null 
  },
  sequenceIndex: { 
    type: Number, 
    default: 0 
  },
  detectionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Detection' 
  }
}, { 
  timestamps: true 
});

TrajectoryEventSchema.index({ vehiclePlate: 1, timestamp: 1 });

export default mongoose.models.TrajectoryEvent || mongoose.model('TrajectoryEvent', TrajectoryEventSchema);
