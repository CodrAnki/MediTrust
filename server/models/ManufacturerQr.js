import mongoose from 'mongoose';

const { Schema } = mongoose;

// Phase 12 QR architecture fix.
//
// Many real medicine boxes print a single static QR that is shared across
// every unit of every product a manufacturer sells (e.g. a marketing URL
// like https://zoxvinabiotech.com/), not a payload unique to one batch.
// That is genuine, real, positive evidence that the package carries an
// authentic manufacturer code — it is just weaker evidence than a true
// per-batch QR, and must never be reported as a "mismatch" simply because
// it doesn't equal one specific batch's own qrCode (see models/Batch.js
// and services/qrService.js).
//
// This collection holds exactly that: known-genuine manufacturer-level QR
// payloads, decoupled from any single Batch record so the same payload can
// legitimately be shared by many batches/medicines from the same
// manufacturer without violating Batch's per-batch qrCode uniqueness.
const manufacturerQrSchema = new Schema(
  {
    manufacturer: { type: String, required: true, trim: true },
    // The exact decoded QR payload (trimmed, case preserved — QR payloads
    // are frequently case-sensitive URLs/tokens).
    payload: { type: String, required: true, trim: true },
    // A human note on how this was confirmed genuine (e.g. "identical
    // static QR observed across N independent product photos"), never
    // used by the pipeline logic itself — purely an audit trail.
    note: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

manufacturerQrSchema.index({ payload: 1 }, { unique: true });

export default mongoose.model('ManufacturerQr', manufacturerQrSchema);
