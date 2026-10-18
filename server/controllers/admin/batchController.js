import Batch from '../../models/Batch.js';
import Medicine from '../../models/Medicine.js';
import ManufacturerQr from '../../models/ManufacturerQr.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { audit, AUDIT } from '../../services/auditService.js';
import { str, num, oneOf, escapeRegex, paging, pageMeta, monthYear, monthYearToNumber, httpError } from '../../utils/adminHelpers.js';

const STATUSES = ['ACTIVE', 'EXPIRED', 'RECALLED', 'SUSPENDED'];

// Explicit uniqueness checks so the admin gets a precise message (the unique
// indexes remain the final guard against races).
async function assertUnique({ batchNumber, qrCode, barcode }, excludeId) {
  const ne = excludeId ? { _id: { $ne: excludeId } } : {};
  if (batchNumber && await Batch.exists({ batchNumber, ...ne })) throw httpError(409, `Batch number "${batchNumber}" already exists.`);
  if (qrCode && await Batch.exists({ qrCode, ...ne })) throw httpError(409, 'This QR code is already registered to another batch.');
  if (barcode && await Batch.exists({ barcode, ...ne })) throw httpError(409, 'This barcode is already registered to another batch.');
}

async function parse(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.batchNumber !== undefined) data.batchNumber = str(body.batchNumber, { required: true, field: 'Batch number', max: 60 });
  if (!partial || body.medicineId !== undefined) {
    const id = str(body.medicineId, { required: true, field: 'Medicine', max: 40 });
    const med = await Medicine.findById(id).lean();
    if (!med) throw httpError(404, 'Medicine not found.');
    data.medicineId = med._id;
    if (!body.manufacturer && !partial) data.manufacturer = med.manufacturer;
  }
  if (!partial || body.manufacturer !== undefined) {
    const m = str(body.manufacturer, { max: 200 });
    if (m) data.manufacturer = m;
    else if (!data.manufacturer && !partial) throw httpError(400, 'Manufacturer is required.');
  }
  if (!partial || body.manufacturingDate !== undefined) data.manufacturingDate = monthYear(body.manufacturingDate, 'Manufacturing date');
  if (!partial || body.expiryDate !== undefined) data.expiryDate = monthYear(body.expiryDate, 'Expiry date');
  const mrp = num(body.mrp, { field: 'MRP', max: 1e7 }); if (mrp !== undefined) data.mrp = mrp;
  if (body.qrCode !== undefined) data.qrCode = str(body.qrCode, { max: 2000 }) ?? null;
  if (body.barcode !== undefined) data.barcode = str(body.barcode, { max: 64 }) ?? null;
  const status = oneOf(body.status, STATUSES, 'status'); if (status) data.status = status;
  return data;
}

function checkDates(d) {
  if (d.manufacturingDate && d.expiryDate && monthYearToNumber(d.expiryDate) <= monthYearToNumber(d.manufacturingDate)) {
    throw httpError(400, 'Expiry date must be after the manufacturing date.');
  }
}

export const listBatches = asyncHandler(async (req, res) => {
  const p = paging(req.query);
  const filter = {};
  const q = str(req.query.q, { max: 100 });
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ batchNumber: rx }, { manufacturer: rx }]; }
  if (req.query.medicineId) filter.medicineId = str(req.query.medicineId, { max: 40 });
  const status = oneOf(req.query.status, STATUSES, 'status'); if (status) filter.status = status;
  if (req.query.hasQr === 'true') filter.qrCode = { $nin: [null, ''] };
  if (req.query.hasBarcode === 'true') filter.barcode = { $nin: [null, ''] };
  const [items, total] = await Promise.all([
    Batch.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('medicineId', 'medicineName strength').lean(),
    Batch.countDocuments(filter),
  ]);
  const data = items.map((b) => { const { medicineId, ...rest } = b; return { ...rest, id: String(b._id), medicineId: String(medicineId?._id || medicineId), medicineName: medicineId?.medicineName || null, medicineStrength: medicineId?.strength || null }; });
  return res.json({ success: true, items: data, ...pageMeta(p, total) });
});

export const getBatch = asyncHandler(async (req, res) => {
  const b = await Batch.findById(req.params.id).populate('medicineId', 'medicineName strength manufacturer').lean();
  if (!b) throw httpError(404, 'Batch not found.');
  return res.json({ success: true, item: { ...b, id: String(b._id) } });
});

export const createBatch = asyncHandler(async (req, res) => {
  const data = await parse(req.body);
  checkDates(data);
  await assertUnique(data);
  const b = await Batch.create(data);
  await audit(req, AUDIT.BATCH_CREATED, { resource: 'batch', resourceId: b._id, details: { batchNumber: b.batchNumber } });
  return res.status(201).json({ success: true, item: { ...b.toObject(), id: String(b._id) } });
});

export const updateBatch = asyncHandler(async (req, res) => {
  const existing = await Batch.findById(req.params.id);
  if (!existing) throw httpError(404, 'Batch not found.');
  const data = await parse(req.body, { partial: true });
  checkDates({ manufacturingDate: data.manufacturingDate || existing.manufacturingDate, expiryDate: data.expiryDate || existing.expiryDate });
  await assertUnique(data, existing._id);
  // Empty QR/barcode must be removed (sparse unique index ignores a missing field, not an empty string).
  const unset = {};
  if (data.qrCode === null) { delete data.qrCode; unset.qrCode = 1; }
  if (data.barcode === null) { delete data.barcode; unset.barcode = 1; }
  const b = await Batch.findByIdAndUpdate(existing._id, { $set: data, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true, runValidators: true });
  await audit(req, AUDIT.BATCH_UPDATED, { resource: 'batch', resourceId: b._id, details: { fields: Object.keys(req.body || {}) } });
  return res.json({ success: true, item: { ...b.toObject(), id: String(b._id) } });
});

export const deleteBatch = asyncHandler(async (req, res) => {
  const b = await Batch.findByIdAndDelete(req.params.id);
  if (!b) throw httpError(404, 'Batch not found.');
  await audit(req, AUDIT.BATCH_DELETED, { resource: 'batch', resourceId: b._id, details: { batchNumber: b.batchNumber } });
  return res.json({ success: true, message: 'Batch deleted.' });
});

// ---- Codes registry --------------------------------------------------------

// Admin tool: does this QR payload / barcode / batch number already exist anywhere?
export const checkCode = asyncHandler(async (req, res) => {
  const value = str(req.query.value, { required: true, field: 'Value', max: 2000 });
  const [qrBatch, barcodeBatch, batchNo, mfrQr] = await Promise.all([
    Batch.findOne({ qrCode: value }, 'batchNumber').lean(),
    Batch.findOne({ barcode: value }, 'batchNumber').lean(),
    Batch.findOne({ batchNumber: value }, 'batchNumber').lean(),
    ManufacturerQr.findOne({ payload: value }, 'manufacturer').lean(),
  ]);
  return res.json({
    success: true,
    duplicate: Boolean(qrBatch || barcodeBatch || batchNo || mfrQr),
    matches: [
      qrBatch && { type: 'Batch QR', reference: qrBatch.batchNumber },
      barcodeBatch && { type: 'Batch barcode', reference: barcodeBatch.batchNumber },
      batchNo && { type: 'Batch number', reference: batchNo.batchNumber },
      mfrQr && { type: 'Manufacturer QR', reference: mfrQr.manufacturer },
    ].filter(Boolean),
  });
});

export const listManufacturerQr = asyncHandler(async (req, res) => {
  const items = await ManufacturerQr.find().sort({ createdAt: -1 }).limit(200).lean();
  return res.json({ success: true, items: items.map((i) => ({ ...i, id: String(i._id) })) });
});

export const createManufacturerQr = asyncHandler(async (req, res) => {
  const manufacturer = str(req.body.manufacturer, { required: true, field: 'Manufacturer', max: 200 });
  const payload = str(req.body.payload, { required: true, field: 'QR payload', max: 2000 });
  const note = str(req.body.note, { max: 500 });
  if (await ManufacturerQr.exists({ payload })) throw httpError(409, 'This QR payload is already registered.');
  if (await Batch.exists({ qrCode: payload })) throw httpError(409, 'This payload is already a batch-specific QR code.');
  const item = await ManufacturerQr.create({ manufacturer, payload, note });
  await audit(req, AUDIT.MANUFACTURER_QR_CREATED, { resource: 'manufacturerQr', resourceId: item._id, details: { manufacturer } });
  return res.status(201).json({ success: true, item: { ...item.toObject(), id: String(item._id) } });
});

export const deleteManufacturerQr = asyncHandler(async (req, res) => {
  const item = await ManufacturerQr.findByIdAndDelete(req.params.id);
  if (!item) throw httpError(404, 'Manufacturer QR not found.');
  await audit(req, AUDIT.MANUFACTURER_QR_DELETED, { resource: 'manufacturerQr', resourceId: item._id, details: { manufacturer: item.manufacturer } });
  return res.json({ success: true, message: 'Manufacturer QR deleted.' });
});
