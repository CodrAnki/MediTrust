import mongoose from 'mongoose';

const { Schema } = mongoose;

// One document per verification a user runs. This is the record Phase 8
// (Scan History) will list/search/paginate.
const scanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestId: { type: String, index: true },

    medicineName: { type: String, required: true },
    genericName: { type: String },
    strength: { type: String },
    manufacturer: { type: String, required: true },
    batchNumber: { type: String, required: true },
    manufacturingDate: { type: String, required: true },
    expiryDate: { type: String, required: true },

    imageReference: { type: String, required: true }, // relative path under /uploads
    // First image remains the history-card thumbnail. The complete set and
    // per-image extraction outcome make a multi-photo result auditable.
    imageReferences: { type: [String], default: [] },
    imageResults: { type: [Schema.Types.Mixed], default: [] },
    ocrTexts: { type: [String], default: [] },
    ocr: { type: Schema.Types.Mixed, default: null },
    confirmedFields: { type: Schema.Types.Mixed, default: null },
    evidence: { type: [Schema.Types.Mixed], default: [] },

    verificationStatus: {
      type: String,
      enum: [
        'VERIFIED', 'HIGH_CONFIDENCE', 'SUSPICIOUS', 'HIGH_RISK', 'UNVERIFIED', 'EXPIRED', 'REFERENCE_NOT_FOUND',
        // Added for the multi-layer pipeline vocabulary
        'MISMATCH', 'UNKNOWN', 'NOT_DETECTED', 'NOT_AVAILABLE',
        // v2 status contract (services/riskEngine.js STATUS). Legacy values above stay readable.
        'VERIFIED_AGAINST_REFERENCE', 'NEEDS_REVIEW', 'MISMATCH_DETECTED', 'INVALID_INPUT', 'PROCESSING_FAILED',
      ],
      required: true,
    },
    // Evidence-agreement score 0-100 (NOT a probability of counterfeiting). null = withheld because
    // essential inputs were unavailable; see assessment.scoreWithheldReason.
    riskScore: { type: Number, default: null, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'unknown'], required: true },
    // Full v2 assessment: checks, reasons, missing items, explanation, next steps, limitations.
    assessment: { type: Schema.Types.Mixed, default: null },

    // Per-signal breakdown, shaped to match services/riskEngine.js output.
    // Kept as a flexible sub-object rather than a rigid schema since the
    // exact shape of each signal (qr/batch/ocr/packaging/duplicate) is
    // still evolving through Phase 10 (real OCR/ML integration).
    // Mixed on purpose: the controller also stores expiry / medicineConsistency / qr.codes,
    // which the previous strict sub-schema silently dropped.
    signals: { type: Schema.Types.Mixed, default: {} },

    // Identification details are kept flexible so older verification records
    // remain readable when the matching pipeline evolves.
    medicineIdentification: { type: Schema.Types.Mixed, default: null },

    detectedIssues: { type: [String], default: [] },
  },
  { timestamps: true }
);

scanSchema.index({ userId: 1, createdAt: -1 });
scanSchema.index({ 'signals.qr.code': 1, createdAt: -1 });

export default mongoose.model('Scan', scanSchema);
