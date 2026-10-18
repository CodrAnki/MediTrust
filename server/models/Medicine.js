import mongoose from 'mongoose';

const { Schema } = mongoose;

// Trusted medicine records used by the local verification pipeline. Records
// may be added by an admin or seeded; legacy imports remain usable as local data.
const medicineSchema = new Schema(
  {
    medicineName: { type: String, required: true, trim: true },
    brandName: { type: String, trim: true },
    genericName: { type: String, trim: true },
    composition: { type: String, trim: true },
    strength: { type: String, trim: true },
    dosageForm: { type: String, trim: true },
    // Legacy imported records may lack a manufacturer; matching treats that as
    // "not available" rather than fabricating a comparison.
    manufacturer: {
      type: String,
      trim: true,
      required: function manufacturerRequired() { return this.source !== 'drugsetu'; },
    },
    description: { type: String, trim: true },
    mrp: { type: Number, min: 0 },
    packSize: { type: String, trim: true },
    image: { type: String }, // legacy single reference image (migrated to ReferenceImage)
    active: { type: Boolean, default: true },

    // Provenance
    source: { type: String, enum: ['admin', 'drugsetu', 'seed'], default: 'admin' },
    sourceUrl: { type: String, trim: true },
    externalProductId: { type: String, trim: true },
    sourceRetrievedAt: { type: Date },
  },
  { timestamps: true }
);

medicineSchema.index({ medicineName: 1 });
medicineSchema.index({ manufacturer: 1 });
medicineSchema.index({ active: 1, createdAt: -1 });
// One local record per external product; sparse so non-imported records are unconstrained.
medicineSchema.index({ externalProductId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Medicine', medicineSchema);
