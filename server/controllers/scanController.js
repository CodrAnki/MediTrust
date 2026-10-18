import Scan from '../models/Scan.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { toClientScan } from './verificationController.js';
import { storedStatusesFor } from '../services/riskEngine.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// GET /api/scans — real, paginated, newest-first, current user's scans
// only. No fake/synthetic records — an empty result set is returned
// honestly as an empty array with total: 0, not padded with placeholders.
export const listScans = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;

  const filter = { userId: req.user.id };
  if (req.query.status) {
    // Also matches records saved before the v2 status contract (e.g. NEEDS_REVIEW <- SUSPICIOUS).
    filter.verificationStatus = { $in: storedStatusesFor(String(req.query.status)) };
  }

  const [scans, total] = await Promise.all([
    Scan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Scan.countDocuments(filter),
  ]);

  return res.status(200).json({
    scans: scans.map((scan) => toClientScan(scan, req)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: skip + scans.length < total,
    },
  });
});

// GET /api/scans/:id — same ownership rule as the verification-result
// endpoint (owner or admin only). A user can never fetch another user's
// scan by guessing/incrementing an id.
export const getScanById = asyncHandler(async (req, res) => {
  const scan = await Scan.findById(req.params.id);
  if (!scan) {
    return res.status(404).json({ message: 'Scan not found.' });
  }

  const isOwner = String(scan.userId) === req.user.id;
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You do not have access to this scan.' });
  }

  return res.status(200).json({ scan: toClientScan(scan, req) });
});
