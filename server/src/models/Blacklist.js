import mongoose from 'mongoose';

const BlacklistSchema = new mongoose.Schema({
  plateNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true,
    index: true 
  },
  reason: { 
    type: String, 
    required: true, 
    trim: true 
  },
  severity: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 
    default: 'HIGH',
    index: true 
  },
  addedBy: { 
    type: String, 
    default: 'Traffic Enforcement Authority' 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  notes: { 
    type: String, 
    default: '' 
  }
}, { 
  timestamps: true 
});

export default mongoose.models.Blacklist || mongoose.model('Blacklist', BlacklistSchema);
