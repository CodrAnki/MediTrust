import { storedStatusesFor } from '../../services/riskEngine.js';
import mongoose from 'mongoose';
import Scan from '../../models/Scan.js';
import User from '../../models/User.js';
import Medicine from '../../models/Medicine.js';
import Batch from '../../models/Batch.js';
import ReferenceImage from '../../models/ReferenceImage.js';
import AuditLog from '../../models/AuditLog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { audit, AUDIT } from '../../services/auditService.js';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../../services/settingsService.js';
import { UPLOAD_LIMITS } from '../../middleware/upload.js';
import { str, bool, oneOf, escapeRegex, paging, pageMeta, httpError } from '../../utils/adminHelpers.js';

const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
const day = (d) => d.toISOString().slice(0, 10);

// ---- Dashboard -------------------------------------------------------------
export const dashboardStats = asyncHandler(async (req, res) => {
  const since14 = new Date(Date.now() - 14 * 864e5);
  const since56 = new Date(Date.now() - 56 * 864e5);
  const [medicines, references, approvedRefs, batches, verifications, statusAgg, riskAgg, trendAgg, topAgg, growthAgg, recentMedicines, recentReferences, recentScans, users] = await Promise.all([
    Medicine.countDocuments(), ReferenceImage.countDocuments(), ReferenceImage.countDocuments({ verificationStatus: 'approved', enabled: true }),
    Batch.countDocuments(), Scan.countDocuments(),
    Scan.aggregate([{ $group: { _id: '$verificationStatus', n: { $sum: 1 } } }]),
    Scan.aggregate([{ $group: { _id: '$riskLevel', n: { $sum: 1 } } }]),
    Scan.aggregate([{ $match: { createdAt: { $gte: since14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: 1 }, verified: { $sum: { $cond: [{ $in: ['$verificationStatus', ['VERIFIED', 'VERIFIED_AGAINST_REFERENCE']] }, 1, 0] } }, needsReview: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'NEEDS_REVIEW'] }, 1, 0] } }, suspicious: { $sum: { $cond: [{ $in: ['$verificationStatus', ['SUSPICIOUS', 'MISMATCH', 'HIGH_RISK', 'MISMATCH_DETECTED']] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
    Scan.aggregate([{ $match: { medicineName: { $ne: 'Not Detected' } } }, { $group: { _id: '$medicineName', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
    Medicine.aggregate([{ $match: { createdAt: { $gte: since56 } } }, { $group: { _id: { $dateToString: { format: '%G-W%V', date: '$createdAt' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Medicine.find({}, 'medicineName manufacturer source createdAt').sort({ createdAt: -1 }).limit(5).lean(),
    ReferenceImage.find({}, 'imageType verificationStatus source createdAt').sort({ createdAt: -1 }).limit(5).populate('medicineId', 'medicineName').lean(),
    Scan.find({}, 'medicineName verificationStatus riskLevel riskScore createdAt').sort({ createdAt: -1 }).limit(8).lean(),
    User.countDocuments({ role: 'user' }),
  ]);
  const status = Object.fromEntries(statusAgg.map((x) => [x._id, x.n]));
  const count = (...keys) => keys.reduce((s, k) => s + (status[k] || 0), 0);
  const trendMap = new Map(trendAgg.map((t) => [t._id, t]));
  const trend = Array.from({ length: 14 }, (_, i) => { const d = day(new Date(Date.now() - (13 - i) * 864e5)); const t = trendMap.get(d); return { date: d.slice(5), total: t?.total || 0, verified: t?.verified || 0, needsReview: t?.needsReview || 0, suspicious: t?.suspicious || 0 }; });
  return res.json({
    success: true,
    totals: { medicines, references, approvedReferences: approvedRefs, batches, verifications, users },
    verified: count('VERIFIED', 'VERIFIED_AGAINST_REFERENCE'),
    needsReview: count('NEEDS_REVIEW'),
    suspicious: count('SUSPICIOUS', 'MISMATCH', 'HIGH_CONFIDENCE'), // HIGH_CONFIDENCE was awarded without a verified batch/expiry
    highRisk: count('HIGH_RISK', 'MISMATCH_DETECTED'),
    unknown: count('UNKNOWN', 'UNVERIFIED', 'REFERENCE_NOT_FOUND', 'NOT_DETECTED', 'NOT_AVAILABLE', 'EXPIRED', 'INVALID_INPUT', 'PROCESSING_FAILED'),
    statusBreakdown: Object.entries(status).map(([name, value]) => ({ name, value })),
    riskDistribution: ['low', 'medium', 'high', 'unknown'].map((name) => ({ name, value: riskAgg.find((r) => r._id === name)?.n || 0 })),
    trend,
    topMedicines: topAgg.map((t) => ({ name: t._id, value: t.n })),
    databaseGrowth: growthAgg.map((g) => ({ week: g._id, added: g.n })),
    recentMedicines: recentMedicines.map((m) => ({ id: String(m._id), name: m.medicineName, manufacturer: m.manufacturer, source: m.source, createdAt: m.createdAt })),
    recentReferences: recentReferences.map((r) => ({ id: String(r._id), medicine: r.medicineId?.medicineName || '—', type: r.imageType, status: r.verificationStatus, source: r.source, createdAt: r.createdAt })),
    recentActivity: recentScans.map((s) => ({ id: String(s._id), medicine: s.medicineName, status: s.verificationStatus, riskLevel: s.riskLevel, riskScore: s.riskScore, createdAt: s.createdAt })),
    health: { mongodb: DB_STATES[mongoose.connection.readyState] || 'unknown', medicines, batches, references, verifications },
  });
});

// ---- Verification logs (read-only: history cannot be edited from the admin) --
export const listVerifications = asyncHandler(async (req, res) => {
  const p = paging(req.query);
  const filter = {};
  const q = str(req.query.medicine, { max: 100 }); if (q) filter.medicineName = new RegExp(escapeRegex(q), 'i');
  const b = str(req.query.batch, { max: 100 }); if (b) filter.batchNumber = new RegExp(escapeRegex(b), 'i');
  const status = str(req.query.status, { max: 40 }); if (status) filter.verificationStatus = { $in: storedStatusesFor(status) };
  const risk = oneOf(req.query.risk, ['low', 'medium', 'high'], 'risk'); if (risk) filter.riskLevel = risk;
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  if ((from && isNaN(from)) || (to && isNaN(to))) throw httpError(400, 'Invalid date filter.');
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: new Date(to.getTime() + 864e5 - 1) }) };
  const [items, total] = await Promise.all([
    Scan.find(filter, '-ocrTexts -imageResults').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate('userId', 'email').lean(),
    Scan.countDocuments(filter),
  ]);
  const data = items.map((s) => ({
    id: String(s._id), medicine: s.medicineName, batch: s.batchNumber, user: s.userId?.email || null,
    ocr: s.signals?.ocr?.consistent === undefined ? null : s.signals.ocr.consistent,
    packagingSimilarity: s.signals?.packaging?.similarity ?? null, packagingStatus: s.signals?.packaging?.status || null,
    qr: s.signals?.qr?.status || null, batchResult: s.signals?.batch?.matchType || null, duplicate: s.signals?.duplicate?.detected ?? null,
    identificationSource: s.medicineIdentification?.source || null,
    riskScore: s.riskScore, riskLevel: s.riskLevel, status: s.verificationStatus, createdAt: s.createdAt,
  }));
  return res.json({ success: true, items: data, ...pageMeta(p, total) });
});

export const getVerification = asyncHandler(async (req, res) => {
  const s = await Scan.findById(req.params.id).populate('userId', 'email name').lean();
  if (!s) throw httpError(404, 'Verification not found.');
  const { _id, __v, userId, ...rest } = s;
  return res.json({ success: true, item: { id: String(_id), user: userId ? { email: userId.email, name: userId.name } : null, ...rest } });
});

// ---- Users -----------------------------------------------------------------
export const listUsers = asyncHandler(async (req, res) => {
  const p = paging(req.query);
  const filter = {};
  const q = str(req.query.q, { max: 100 });
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { email: rx }]; }
  const role = oneOf(req.query.role, ['user', 'admin'], 'role'); if (role) filter.role = role;
  const active = bool(req.query.active); if (active !== undefined) filter.isActive = active;
  const [users, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), User.countDocuments(filter)]);
  const agg = await Scan.aggregate([{ $match: { userId: { $in: users.map((u) => u._id) } } }, { $group: { _id: '$userId', n: { $sum: 1 }, last: { $max: '$createdAt' } } }]);
  const map = new Map(agg.map((a) => [String(a._id), a]));
  // passwordHash is select:false and is never projected here.
  return res.json({
    success: true, ...pageMeta(p, total),
    items: users.map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, isActive: u.isActive !== false, registeredAt: u.createdAt, lastLogin: u.lastLogin || null, lastActivity: map.get(String(u._id))?.last || null, verificationCount: map.get(String(u._id))?.n || 0 })),
  });
});

export const getUserHistory = asyncHandler(async (req, res) => {
  const scans = await Scan.find({ userId: req.params.id }, 'medicineName batchNumber verificationStatus riskScore riskLevel createdAt').sort({ createdAt: -1 }).limit(25).lean();
  return res.json({ success: true, items: scans.map((s) => ({ ...s, id: String(s._id) })) });
});

export const setUserActive = asyncHandler(async (req, res) => {
  const active = bool(req.body.isActive);
  if (active === undefined) throw httpError(400, 'isActive is required.');
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found.');
  if (String(user._id) === req.user.id) throw httpError(400, 'You cannot change your own status.');
  if (user.role === 'admin') throw httpError(403, 'Admin accounts cannot be changed from here.');
  user.isActive = active;
  await user.save();
  await audit(req, AUDIT.USER_STATUS_CHANGED, { resource: 'user', resourceId: user._id, details: { isActive: active } });
  return res.json({ success: true, isActive: active });
});

// ---- Audit logs ------------------------------------------------------------
export const listAuditLogs = asyncHandler(async (req, res) => {
  const p = paging(req.query, { defaultLimit: 30 });
  const filter = {};
  const action = str(req.query.action, { max: 60 }); if (action) filter.action = action;
  const result = oneOf(req.query.result, ['success', 'failure'], 'result'); if (result) filter.result = result;
  const resource = str(req.query.resource, { max: 60 }); if (resource) filter.resource = resource;
  const [items, total] = await Promise.all([AuditLog.find(filter).sort({ timestamp: -1 }).skip(p.skip).limit(p.limit).lean(), AuditLog.countDocuments(filter)]);
  return res.json({ success: true, actions: Object.values(AUDIT), items: items.map((a) => ({ id: String(a._id), adminId: a.adminId ? String(a.adminId) : null, admin: a.adminEmail || null, action: a.action, resource: a.resource, resourceId: a.resourceId, result: a.result, ip: a.ip, timestamp: a.timestamp, details: a.details })), ...pageMeta(p, total) });
});

// ---- Risk engine + system settings (validated, bounded, no secrets) ---------
export const getRiskEngine = asyncHandler(async (req, res) => {
  const s = await getSettings();
  return res.json({ success: true, risk: s.risk, defaults: DEFAULT_SETTINGS.risk });
});

export const putRiskEngine = asyncHandler(async (req, res) => {
  const { value, error } = await updateSettings('risk', req.body, req.user.id);
  if (error) throw httpError(400, error);
  await audit(req, AUDIT.SETTINGS_UPDATED, { resource: 'riskEngine', details: { fields: Object.keys(req.body) } });
  return res.json({ success: true, risk: value.risk });
});

export const getSystemSettings = asyncHandler(async (req, res) => {
  const s = await getSettings();
  return res.json({
    success: true, system: s.system,
    // Read-only facts about this deployment — never secrets.
    readOnly: { ocrProvider: 'tesseract.js (local)', imageSimilarity: 'dHash + colour profile (local)', maxUploadMb: UPLOAD_LIMITS.maxFileMb, allowedFormats: UPLOAD_LIMITS.allowedFormats },
  });
});

export const putSystemSettings = asyncHandler(async (req, res) => {
  const { value, error } = await updateSettings('system', req.body, req.user.id);
  if (error) throw httpError(400, error);
  await audit(req, AUDIT.SETTINGS_UPDATED, { resource: 'settings', details: { fields: Object.keys(req.body) } });
  return res.json({ success: true, system: value.system });
});
