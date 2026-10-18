import mongoose from 'mongoose';

const { Schema } = mongoose;

// Key/value store for safe, validated, non-secret configuration
// (risk thresholds, feature toggles). Secrets are never stored here.
const settingSchema = new Schema(
  { key: { type: String, required: true, unique: true }, value: { type: Schema.Types.Mixed, default: {} }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User' } },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);
