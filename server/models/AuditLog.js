import mongoose from 'mongoose';

const { Schema } = mongoose;

// Append-only admin activity trail. Never stores secrets or passwords.
const auditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    adminEmail: { type: String },
    action: { type: String, required: true, index: true },
    resource: { type: String },
    resourceId: { type: String },
    result: { type: String, enum: ['success', 'failure'], default: 'success' },
    ip: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

auditLogSchema.index({ timestamp: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
