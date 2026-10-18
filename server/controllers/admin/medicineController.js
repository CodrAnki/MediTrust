import Medicine from '../../models/Medicine.js';
import Batch from '../../models/Batch.js';
import ReferenceImage from '../../models/ReferenceImage.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { audit, AUDIT } from '../../services/auditService.js';
import { removeLocalFile } from '../../services/referenceImageService.js';
import { str, num, bool, oneOf, escapeRegex, paging, pageMeta, httpError } from '../../utils/adminHelpers.js';

const SOURCES = ['admin', 'drugsetu', 'seed'];

// Whitelist of editable fields — no mass assignment.
function parseBody(body, { partial = false } = {}) {
  const req = (field, label) => str(body[field], { required: !partial, field: label, max: 200 });
  const data = {
    medicineName: req('medicineName', 'Medicine name'),
    brandName: str(body.brandName, { max: 200 }),
    genericName: str(body.genericName, { max: 200 }),
    composition: str(body.composition, { max: 500 }),
    strength: str(body.strength, { max: 100 }),
    dosageForm: str(body.dosageForm, { max: 100 }),
    manufacturer: req('manufacturer', 'Manufacturer'),
    description: str(body.description, { max: 2000 }),
    mrp: num(body.mrp, { field: 'MRP', max: 1e7 }),
    packSize: str(body.packSize, { max: 100 }),
    active: bool(body.active),
  };
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

export const listMedicines = asyncHandler(async (req, res) => {
  const p = paging(req.query);
  const filter = {};
  const q = str(req.query.q, { max: 100 });
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ medicineName: rx }, { brandName: rx }, { genericName: rx }, { composition: rx }, { manufacturer: rx }];
  }
  const source = oneOf(req.query.source, SOURCES, 'source'); if (source) filter.source = source;
  const active = bool(req.query.active); if (active !== undefined) filter.active = active;
  const [items, total] = await Promise.all([
    Medicine.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Medicine.countDocuments(filter),
  ]);
  // Per-medicine counts for the table (one grouped query each, not N+1).
  const ids = items.map((m) => m._id);
  const [batchCounts, refCounts] = await Promise.all([
    Batch.aggregate([{ $match: { medicineId: { $in: ids } } }, { $group: { _id: '$medicineId', n: { $sum: 1 } } }]),
    ReferenceImage.aggregate([{ $match: { medicineId: { $in: ids }, verificationStatus: 'approved', enabled: true } }, { $group: { _id: '$medicineId', n: { $sum: 1 } } }]),
  ]);
  const bMap = new Map(batchCounts.map((x) => [String(x._id), x.n]));
  const rMap = new Map(refCounts.map((x) => [String(x._id), x.n]));
  const data = items.map((m) => ({ ...m, id: String(m._id), batchCount: bMap.get(String(m._id)) || 0, approvedReferenceCount: rMap.get(String(m._id)) || 0 }));
  return res.json({ success: true, items: data, ...pageMeta(p, total) });
});

export const getMedicine = asyncHandler(async (req, res) => {
  const m = await Medicine.findById(req.params.id).lean();
  if (!m) throw httpError(404, 'Medicine not found.');
  const [batches, references] = await Promise.all([
    Batch.find({ medicineId: m._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ReferenceImage.countDocuments({ medicineId: m._id }),
  ]);
  return res.json({ success: true, item: { ...m, id: String(m._id) }, batches, referenceCount: references });
});

export const createMedicine = asyncHandler(async (req, res) => {
  const data = parseBody(req.body);
  const m = await Medicine.create({ ...data, source: 'admin' });
  await audit(req, AUDIT.MEDICINE_CREATED, { resource: 'medicine', resourceId: m._id, details: { medicineName: m.medicineName } });
  return res.status(201).json({ success: true, item: { ...m.toObject(), id: String(m._id) } });
});

export const updateMedicine = asyncHandler(async (req, res) => {
  const data = parseBody(req.body, { partial: true });
  const m = await Medicine.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
  if (!m) throw httpError(404, 'Medicine not found.');
  await audit(req, AUDIT.MEDICINE_UPDATED, { resource: 'medicine', resourceId: m._id, details: { fields: Object.keys(data) } });
  return res.json({ success: true, item: { ...m.toObject(), id: String(m._id) } });
});

export const deleteMedicine = asyncHandler(async (req, res) => {
  const m = await Medicine.findById(req.params.id);
  if (!m) throw httpError(404, 'Medicine not found.');
  const batchCount = await Batch.countDocuments({ medicineId: m._id });
  if (batchCount) throw httpError(409, `This medicine has ${batchCount} batch record(s). Delete or reassign them first, or deactivate the medicine instead.`);
  const refs = await ReferenceImage.find({ medicineId: m._id }).lean();
  await ReferenceImage.deleteMany({ medicineId: m._id });
  refs.forEach((r) => removeLocalFile(r.imageUrl));
  await m.deleteOne();
  await audit(req, AUDIT.MEDICINE_DELETED, { resource: 'medicine', resourceId: m._id, details: { medicineName: m.medicineName, referencesRemoved: refs.length } });
  return res.json({ success: true, message: 'Medicine deleted.' });
});

// Lightweight list for dropdowns (id + label only).
export const medicineOptions = asyncHandler(async (req, res) => {
  const q = str(req.query.q, { max: 100 });
  const filter = q ? { medicineName: new RegExp(escapeRegex(q), 'i') } : {};
  const items = await Medicine.find(filter, 'medicineName brandName strength manufacturer').sort({ medicineName: 1 }).limit(50).lean();
  return res.json({ success: true, items: items.map((m) => ({ id: String(m._id), label: `${m.medicineName}${m.strength ? ` ${m.strength}` : ''}`, manufacturer: m.manufacturer })) });
});
