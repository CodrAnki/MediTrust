import mongoose from 'mongoose';
import Scan from '../models/Scan.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { toClientScan } from './verificationController.js';

// GET /api/dashboard/stats — real aggregate MongoDB stats for the
// current user. No hardcoded numbers: every figure here comes from an
// actual count/aggregation over that user's real Scan documents. A
// brand-new account with zero scans correctly gets all-zero stats, not
// filler data.
export const getDashboardStats = asyncHandler(async (req, res) => {
  const userObjectId = new mongoose.Types.ObjectId(req.user.id);

  const [totalScans, byStatus, byRisk, recentScans] = await Promise.all([
    Scan.countDocuments({ userId: userObjectId }),
    Scan.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
    ]),
    Scan.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
    ]),
    Scan.find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(5),
  ]);

  // Group the full status vocabulary into the four dashboard buckets.
  // HIGH_CONFIDENCE is no longer counted as verified: it was awarded without a verified batch/expiry.
  const BUCKET = { VERIFIED: 'VERIFIED', VERIFIED_AGAINST_REFERENCE: 'VERIFIED', SUSPICIOUS: 'SUSPICIOUS', NEEDS_REVIEW: 'SUSPICIOUS', MISMATCH: 'SUSPICIOUS', MISMATCH_DETECTED: 'HIGH_RISK', HIGH_RISK: 'HIGH_RISK' };
  const statusMap = { VERIFIED: 0, SUSPICIOUS: 0, HIGH_RISK: 0, UNVERIFIED: 0 };
  for (const row of byStatus) {
    statusMap[BUCKET[row._id] || 'UNVERIFIED'] += row.count; // unknown / not found / not detected / expired
  }

  const riskMap = { low: 0, medium: 0, high: 0, unknown: 0 };
  for (const row of byRisk) {
    if (row._id in riskMap) riskMap[row._id] = row.count;
  }

  return res.status(200).json({
    totalScans,
    verified: statusMap.VERIFIED,
    suspicious: statusMap.SUSPICIOUS,
    highRisk: statusMap.HIGH_RISK,
    unverified: statusMap.UNVERIFIED,
    riskDistribution: riskMap,
    recentScans: recentScans.map((scan) => toClientScan(scan, req)),
    latestScan: recentScans.length ? toClientScan(recentScans[0], req) : null,
  });
});
