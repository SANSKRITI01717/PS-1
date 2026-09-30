import mongoose from 'mongoose';

const VehicleSchema = new mongoose.Schema({
  plateNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true,
    index: true 
  },
  vehicleType: { 
    type: String, 
    default: 'UNKNOWN' 
  },
  makeModel: { 
    type: String, 
    default: 'UNKNOWN' 
  },
  color: { 
    type: String, 
    default: 'UNKNOWN' 
  },
  firstSeen: { 
    type: Date, 
    default: Date.now 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  totalDetections: { 
    type: Number, 
    default: 1 
  },
  isBlacklisted: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  flagReason: { 
    type: String, 
    default: '' 
  }
}, { 
  timestamps: true 
});

export default mongoose.models.Vehicle || mongoose.model('Vehicle', VehicleSchema);
