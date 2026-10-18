import mongoose from 'mongoose';

const { Schema } = mongoose;

// Reserved for Phase 9 (Admin: Batch Management). qrService.js/batchService.js
// query this collection today with real OCR-extracted batch numbers and
// real decoded QR payloads (Phase 8.5) — matches are still rare in practice
// because the seed data below is a tiny hand-made dev dataset, not a real
// manufacturer database.
//
// Phase 12 QR architecture fix: `qrCode` is now OPTIONAL. Most real
// packaging in this dataset only carries a single shared manufacturer/
// marketing QR (see models/ManufacturerQr.js), not a genuine per-batch
// payload — forcing every Batch to have a unique qrCode previously meant
// storing an obviously-fake `DEMO-NO-QR-<batch>` placeholder just to
// satisfy the schema, which is what caused a genuine manufacturer QR to
// be reported as a batch "MISMATCH" (the decoded real value could never
// equal the fake placeholder). A batch only stores a real value here when
// it genuinely has its own unique, batch-specific QR payload.
const batchSchema = new Schema(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchNumber: { type: String, required: true, trim: true, unique: true },
    manufacturingDate: { type: String, required: true }, // "MM/YYYY"
    expiryDate: { type: String, required: true }, // "MM/YYYY"
    manufacturer: { type: String, required: true, trim: true },
    // Genuine batch-specific QR payload only — never a placeholder. Left
    // unset when the batch has no real per-batch QR (the common case here;
    // see ManufacturerQr.js for the shared marketing-QR case instead).
    qrCode: { type: String, trim: true, default: null },
    mrp: { type: Number, min: 0 },
    // 1D/EAN barcode registered for this batch (stored for the registry and
    // duplicate detection; the pipeline does not decode 1D barcodes yet).
    barcode: { type: String, trim: true, default: null },
    serialPrefix: { type: String, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'RECALLED', 'SUSPENDED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true }
);

// NOTE: `batchNumber` already declares `unique: true` on the field above,
// which implicitly creates a unique index — an additional explicit
// `batchSchema.index({ batchNumber: 1 }, { unique: true })` here was a
// duplicate of the same index and is what produced the
// "Duplicate schema index on {"batchNumber":1}" Mongoose warning at startup.

// `sparse: true` so any number of batches can leave qrCode unset (null)
// without colliding on uniqueness — only two batches genuinely sharing
// the same real per-batch QR value would violate this index, which is
// exactly the case that should be rejected.
batchSchema.index({ qrCode: 1 }, { unique: true, sparse: true });
batchSchema.index({ barcode: 1 }, { unique: true, sparse: true });
batchSchema.index({ medicineId: 1 });

export default mongoose.model('Batch', batchSchema);
