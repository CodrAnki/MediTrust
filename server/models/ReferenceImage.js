import mongoose from 'mongoose';

const { Schema } = mongoose;

export const IMAGE_TYPES = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'STRIP', 'BOTTLE', 'LABEL', 'OTHER'];

// Approved reference packaging photos. ONLY verificationStatus === 'approved'
// AND enabled === true are ever used for trusted packaging comparison.
// Trusted reference images are kept separate from test/evaluation uploads
// (those live in Scan / server/uploads).
const referenceImageSchema = new Schema(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', default: null },
    imageType: { type: String, enum: IMAGE_TYPES, default: 'FRONT' },
    // Local file name under server/reference-images/, or an http(s) URL.
    imageUrl: { type: String, required: true },
    isLocalFile: { type: Boolean, default: true },
    mimeType: String,
    size: Number,
    imageHash: { type: String, default: null }, // sha256 of the file bytes
    perceptualHash: { type: String, default: null },

    source: { type: String, enum: ['admin', 'drugsetu', 'seed'], default: 'admin' },
    sourceUrl: { type: String, trim: true },
    retrievedAt: { type: Date },
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    enabled: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

referenceImageSchema.index({ imageHash: 1 }, { unique: true, sparse: true });
referenceImageSchema.index({ medicineId: 1, verificationStatus: 1, enabled: 1 });

export default mongoose.model('ReferenceImage', referenceImageSchema);
