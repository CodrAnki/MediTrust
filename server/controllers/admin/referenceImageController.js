import fs from 'fs';
import ReferenceImage, { IMAGE_TYPES } from '../../models/ReferenceImage.js';
import Medicine from '../../models/Medicine.js';
import Batch from '../../models/Batch.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { audit, AUDIT } from '../../services/auditService.js';
import { inspectUploadedImage, referenceUrl, removeLocalFile } from '../../services/referenceImageService.js';
import { str, bool, oneOf, paging, pageMeta, httpError } from '../../utils/adminHelpers.js';

const STATUSES = ['pending', 'approved', 'rejected'];
const SOURCES = ['admin', 'drugsetu', 'seed'];

const present = (doc, req) => {
  const o = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = o;
  return { id: String(_id), ...rest, url: referenceUrl(o, req) };
};
const discard = (files) => files.forEach((f) => fs.promises.unlink(f.path).catch(() => {}));

export const listReferenceImages = asyncHandler(async (req, res) => {
  const p = paging(req.query, { defaultLimit: 24, maxLimit: 60 });
  const filter = {};
  if (req.query.medicineId) filter.medicineId = str(req.query.medicineId, { max: 40 });
  const status = oneOf(req.query.status, STATUSES, 'status'); if (status) filter.verificationStatus = status;
  const type = oneOf(req.query.type, IMAGE_TYPES, 'type'); if (type) filter.imageType = type;
  const source = oneOf(req.query.source, SOURCES, 'source'); if (source) filter.source = source;
  const enabled = bool(req.query.enabled); if (enabled !== undefined) filter.enabled = enabled;
  const [items, total] = await Promise.all([
    ReferenceImage.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('medicineId', 'medicineName strength manufacturer').lean(),
    ReferenceImage.countDocuments(filter),
  ]);
  const data = items.map((i) => {
    const { medicineId, ...rest } = i;
    return { ...present(rest, req), medicineId: medicineId?._id ? String(medicineId._id) : String(medicineId), medicine: medicineId?.medicineName ? { name: medicineId.medicineName, strength: medicineId.strength, manufacturer: medicineId.manufacturer } : null };
  });
  return res.json({ success: true, items: data, ...pageMeta(p, total) });
});

// Multiple upload: field "images" (up to 10). Each file is validated for
// extension, MIME, size and that it decodes as a real image; exact duplicates
// (sha256) are rejected per-file instead of failing the whole batch.
export const uploadReferenceImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw httpError(400, 'Select at least one image.');
  try {
    const medicineId = str(req.body.medicineId, { required: true, field: 'Medicine', max: 40 });
    const medicine = await Medicine.findById(medicineId).lean();
    if (!medicine) throw httpError(404, 'Medicine not found.');
    const imageType = oneOf(req.body.imageType, IMAGE_TYPES, 'imageType') || 'FRONT';
    let batchId = null;
    if (req.body.batchId) {
      const b = await Batch.findById(str(req.body.batchId, { max: 40 })).lean();
      if (!b) throw httpError(404, 'Batch not found.');
      batchId = b._id;
    }
    const notes = str(req.body.notes, { max: 500 });
    const approve = bool(req.body.approve) === true;

    const created = []; const rejected = [];
    for (const file of files) {
      try {
        const info = await inspectUploadedImage(file);
        const dup = await ReferenceImage.findOne({ imageHash: info.imageHash }).lean();
        if (dup) { discard([file]); rejected.push({ name: file.originalname, reason: 'Duplicate image (identical file already exists).' }); continue; }
        const doc = await ReferenceImage.create({
          medicineId: medicine._id, batchId, imageType, imageUrl: file.filename, isLocalFile: true,
          mimeType: file.mimetype, size: file.size, imageHash: info.imageHash, perceptualHash: info.perceptualHash,
          source: 'admin', retrievedAt: new Date(),
          verificationStatus: approve ? 'approved' : 'pending', enabled: true,
          metadata: { notes, originalName: file.originalname, width: info.width, height: info.height },
          uploadedBy: req.user.id, ...(approve ? { reviewedBy: req.user.id, reviewedAt: new Date() } : {}),
        });
        created.push(present(doc, req));
        await audit(req, AUDIT.REFERENCE_IMAGE_UPLOADED, { resource: 'referenceImage', resourceId: doc._id, details: { medicineId: String(medicine._id), imageType, status: doc.verificationStatus } });
        if (approve) await audit(req, AUDIT.REFERENCE_IMAGE_APPROVED, { resource: 'referenceImage', resourceId: doc._id });
      } catch (err) {
        discard([file]);
        rejected.push({ name: file.originalname, reason: err.status ? err.message : 'Could not process this image.' });
      }
    }
    return res.status(created.length ? 201 : 400).json({ success: created.length > 0, items: created, rejected, message: created.length ? undefined : (rejected[0]?.reason || 'No images were uploaded.') });
  } catch (err) {
    discard(files);
    throw err;
  }
});

// Update metadata / enabled / approval status, and optionally REPLACE the file
// (field "image"). Approve/reject transitions are audited separately.
export const updateReferenceImage = asyncHandler(async (req, res) => {
  const file = req.file;
  try {
    const doc = await ReferenceImage.findById(req.params.id);
    if (!doc) throw httpError(404, 'Reference image not found.');
    const before = doc.verificationStatus;

    const type = oneOf(req.body.imageType, IMAGE_TYPES, 'imageType'); if (type) doc.imageType = type;
    const enabled = bool(req.body.enabled); if (enabled !== undefined) doc.enabled = enabled;
    const notes = str(req.body.notes, { max: 500 }); if (notes !== undefined) doc.metadata = { ...(doc.metadata || {}), notes };
    const status = oneOf(req.body.verificationStatus, STATUSES, 'verificationStatus');
    if (status) { doc.verificationStatus = status; doc.reviewedBy = req.user.id; doc.reviewedAt = new Date(); }

    let oldFile = null;
    if (file) {
      const info = await inspectUploadedImage(file);
      const dup = await ReferenceImage.findOne({ imageHash: info.imageHash, _id: { $ne: doc._id } }).lean();
      if (dup) throw httpError(409, 'Duplicate image (identical file already exists).');
      oldFile = doc.imageUrl;
      Object.assign(doc, { imageUrl: file.filename, isLocalFile: true, mimeType: file.mimetype, size: file.size, imageHash: info.imageHash, perceptualHash: info.perceptualHash });
      // A replaced image must be re-reviewed unless the admin explicitly set a status.
      if (!status) { doc.verificationStatus = 'pending'; doc.reviewedBy = undefined; doc.reviewedAt = undefined; }
    }
    await doc.save();
    if (oldFile) removeLocalFile(oldFile);

    const action = doc.verificationStatus !== before
      ? (doc.verificationStatus === 'approved' ? AUDIT.REFERENCE_IMAGE_APPROVED : doc.verificationStatus === 'rejected' ? AUDIT.REFERENCE_IMAGE_REJECTED : AUDIT.REFERENCE_IMAGE_UPDATED)
      : AUDIT.REFERENCE_IMAGE_UPDATED;
    await audit(req, action, { resource: 'referenceImage', resourceId: doc._id, details: { from: before, to: doc.verificationStatus, replaced: Boolean(file) } });
    return res.json({ success: true, item: present(doc, req) });
  } catch (err) {
    if (file) fs.promises.unlink(file.path).catch(() => {});
    throw err;
  }
});

export const deleteReferenceImage = asyncHandler(async (req, res) => {
  const doc = await ReferenceImage.findById(req.params.id);
  if (!doc) throw httpError(404, 'Reference image not found.');
  await doc.deleteOne();
  removeLocalFile(doc.imageUrl);
  await audit(req, AUDIT.REFERENCE_IMAGE_DELETED, { resource: 'referenceImage', resourceId: doc._id, details: { medicineId: String(doc.medicineId) } });
  return res.json({ success: true, message: 'Reference image deleted.' });
});

