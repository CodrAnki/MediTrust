import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import Scan from '../models/Scan.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractMedicineInfo, OCR_STATUS, OCR_STATUS_MESSAGES } from '../services/ocrService.js';
import { decodeQr, classifyQrCodes } from '../services/qrService.js';
import { checkBatch, checkBatchMedicineConsistency } from '../services/batchService.js';
import { identifyMedicine } from '../services/medicineIdentificationService.js';
import { analyzeAgainstApprovedReferences } from '../services/referenceImageService.js';
import { getSettings, weightsFromSettings } from '../services/settingsService.js';
import { startJob, setStage, finishJob, getJob, isValidJobId, acquireUserSlot } from '../services/progressService.js';
import { env } from '../config/env.js';
import { withTimeout, TimeoutError } from '../utils/timeout.js';
import { checkDuplicateActivity } from '../services/duplicateService.js';
import { assessVerification, riskLevelFromScore } from '../services/riskEngine.js';
import { validateExpiry } from '../utils/expiry.js';
import { mergeConfirmedFields, parseConfirmedFields, VERIFICATION_FIELDS } from '../services/verificationFields.js';

// Shapes a Scan document for the frontend: Mongo's _id -> id, and the
// stored relative image path -> an absolute URL the <img> tag can load.
function toClientScan(scan, req) {
  const obj = scan.toObject ? scan.toObject() : scan;
  const { _id, __v, userId, ...rest } = obj;
  return {
    id: String(_id),
    ...rest,
    imageReference: `${req.protocol}://${req.get('host')}${obj.imageReference}`,
    imageReferences: (obj.imageReferences || [obj.imageReference]).map(
      (reference) => `${req.protocol}://${req.get('host')}${reference}`
    ),
  };
}

// The Scan schema requires these fields (they're always shown on the
// result page), but real OCR won't always find every one of them even on
// a genuine medicine photo (e.g. batch number partially obscured). This
// fills gaps with an explicit "not detected" marker instead of null —
// never a fabricated value.
function orNotDetected(value, fallback = 'Not Detected') {
  return value && String(value).trim() ? value : fallback;
}

async function removeFailedUploads(files) {
  await Promise.all(files.map(async (file) => {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('[Verification upload cleanup] Could not remove failed upload:', error.message);
    }
  }));
}

export const previewVerification = asyncHandler(async (req, res) => {
  const medicineFiles = [...(req.files?.image || []), ...(req.files?.images || [])];
  const qrFiles = req.files?.qrImage || [];
  const files = [...medicineFiles, ...qrFiles];
  const fail = (status, code, message) => res.status(status).json({ success: false, code, message, requestId: req.id });

  if (!medicineFiles.length) {
    await removeFailedUploads(files);
    return fail(400, 'NO_IMAGE', 'At least one medicine image is required.');
  }
  if (medicineFiles.length > 5) {
    await removeFailedUploads(files);
    return fail(400, 'TOO_MANY_IMAGES', 'A maximum of 5 medicine images can be reviewed at once.');
  }

  const releaseSlot = acquireUserSlot(req.user.id, env.limits.verificationTimeoutMs + 15_000);
  if (!releaseSlot) {
    await removeFailedUploads(files);
    return fail(409, 'VERIFICATION_IN_PROGRESS', 'A verification or scan review is already running for your account. Please wait for it to finish.');
  }

  try {
    // Keep the interactive preview within typical reverse-proxy request limits.
    // Tesseract uses a single queued worker, so OCR-ing 5 images in one preview
    // can take several per-image timeouts back-to-back. Preview the first two
    // medicine photos; the final verification pipeline still processes all
    // submitted photos and must be used for the actual risk decision.
    const previewMedicineFiles = medicineFiles.slice(0, 2);
    const omittedMedicineCount = medicineFiles.length - previewMedicineFiles.length;
    const startedAt = Date.now();
    console.info('[verification:preview] started', {
      requestId: req.id,
      medicineImages: medicineFiles.length,
      qrImages: qrFiles.length,
      previewOcrImages: previewMedicineFiles.length,
    });

    const imageResults = await Promise.all([
      ...previewMedicineFiles.map(async (file) => {
        const imageStartedAt = Date.now();
        try {
          const ocr = await extractMedicineInfo(file.path);
          console.info('[verification:preview] OCR completed', {
            requestId: req.id,
            durationMs: Date.now() - imageStartedAt,
            status: ocr?.status || 'UNKNOWN',
          });
          return {
            kind: 'medicine',
            ocr,
            qr: null,
            error: ocr.status === OCR_STATUS.OK ? null : (OCR_STATUS_MESSAGES[ocr.status] || null),
          };
        } catch (error) {
          console.error('[verification:preview] OCR failed', {
            requestId: req.id,
            durationMs: Date.now() - imageStartedAt,
            message: error?.message || 'unknown error',
          });
          return { kind: 'medicine', ocr: null, qr: null, error: 'This image could not be processed.' };
        }
      }),
      ...qrFiles.map(async (file) => {
        try {
          const qr = await decodeQr(file.path);
          return { kind: 'qr', ocr: null, qr, error: qr.code ? null : 'No QR code could be read from this image.' };
        } catch {
          return { kind: 'qr', ocr: null, qr: null, error: 'This image could not be processed.' };
        }
      }),
    ]);

    const medicineResults = imageResults.filter((result) => result.kind === 'medicine');
    if (medicineResults.every((result) => result.ocr?.status === OCR_STATUS.OCR_FAILED && !result.qr?.code)) {
      return fail(503, 'OCR_UNAVAILABLE', 'Text extraction is temporarily unavailable. Please try again in a moment.');
    }

    const fields = Object.fromEntries(VERIFICATION_FIELDS.map((field) => [
      field,
      medicineResults.map((result) => result.ocr?.[field]).find((value) => value && String(value).trim()) || '',
    ]));
    const statusRank = { DETECTED: 4, INVALID: 3, UNREADABLE: 2, NOT_DETECTED: 1 };
    const fieldStatus = Object.fromEntries(VERIFICATION_FIELDS.map((field) => [
      field,
      medicineResults.map((result) => result.ocr?.fieldStatus?.[field])
        .filter(Boolean)
        .sort((left, right) => (statusRank[right] || 0) - (statusRank[left] || 0))[0] || 'NOT_DETECTED',
    ]));
    const qrCodes = [...new Set(imageResults.map((result) => result.qr?.code).filter(Boolean))];
    const images = imageResults.map(({ kind, ocr, qr, error }) => ({
      kind,
      rawText: ocr?.rawText || '',
      qrCode: qr?.code || null,
      error,
    }));

    console.info('[verification:preview] completed', {
      requestId: req.id,
      durationMs: Date.now() - startedAt,
      extractedFields: Object.values(fields).filter(Boolean).length,
      omittedMedicineImages: omittedMedicineCount,
    });

    return res.status(200).json({
      success: true,
      requestId: req.id,
      extracted: {
        fields,
        fieldStatus,
        qrCodes,
        images,
        ...(omittedMedicineCount > 0 ? {
          notice: `Preview extracted the first 2 medicine photos to keep the request responsive. ${omittedMedicineCount} additional photo(s) will be processed during final verification.`,
          omittedMedicineImages: omittedMedicineCount,
        } : {}),
      },
    });
  } finally {
    releaseSlot();
    await removeFailedUploads(files);
  }
});

export const submitVerification = asyncHandler(async (req, res) => {
  const medicineFiles = [...(req.files?.image || []), ...(req.files?.images || [])];
  const qrFiles = req.files?.qrImage || [];
  const files = [...medicineFiles, ...qrFiles];
  const fail = (status, code, message) => res.status(status).json({ success: false, code, message, requestId: req.id });
  if (!medicineFiles.length) {
    await removeFailedUploads(files);
    return fail(400, 'NO_IMAGE', 'At least one medicine image is required.');
  }
  if (medicineFiles.length > 5) {
    await removeFailedUploads(files);
    return fail(400, 'TOO_MANY_IMAGES', 'A maximum of 5 medicine images can be verified at once.');
  }
  let confirmedFields;
  try {
    confirmedFields = parseConfirmedFields(req.body?.confirmedFields);
  } catch (error) {
    await removeFailedUploads(files);
    return fail(error.status || 400, error.code || 'INVALID_CONFIRMED_FIELDS', error.message);
  }

  // One verification at a time per user: OCR is CPU-heavy and serialised, so a double
  // click / second tab / retry-while-running would only slow everything down and race.
  const releaseSlot = acquireUserSlot(req.user.id, env.limits.verificationTimeoutMs + 15_000);
  if (!releaseSlot) {
    await removeFailedUploads(files);
    return fail(409, 'VERIFICATION_IN_PROGRESS', 'A verification is already running for your account. Please wait for it to finish.');
  }

  // Optional client-generated job id: lets the processing page poll REAL stage
  // progress (see services/progressService.js). Requests without one still work.
  // The verification id used for tracing is always req.id (also returned as `requestId`).
  const jobId = isValidJobId(req.body?.jobId) ? req.body.jobId : null;
  const requestId = req.id;
  if (jobId && startJob(jobId, req.user.id, requestId) === 'duplicate') {
    releaseSlot();
    await removeFailedUploads(files);
    return fail(409, 'DUPLICATE_SUBMISSION', 'This verification was already submitted.');
  }

  const ctx = { aborted: false };
  const stage = (name, status, note) => {
    // After the deadline no NEW stage may start (the response has already been sent).
    if (ctx.aborted && status === 'active') throw new TimeoutError('Verification', env.limits.verificationTimeoutMs);
    setStage(jobId, name, status, note);
  };
  stage('image_received', 'done');
  let scanPersisted = false;

  const pipeline = async () => {
    const settings = await getSettings();

    // Medicine photos get OCR and QR decoding; a separately tagged QR photo
    // is decoded only. Classification needs the batch/medicine context below.
    stage('ocr', 'active');
    const imageResults = await Promise.all(files.map(async (file, index) => {
      const kind = index < medicineFiles.length ? 'medicine' : 'qr';
      try {
        const ocr = kind === 'medicine' ? await extractMedicineInfo(file.path) : null;
        const qr = await decodeQr(file.path);
        return {
          index, filename: file.filename, kind, ocrError: ocr?.error || null,
          success: kind === 'qr' ? Boolean(qr.code) : ocr.status === OCR_STATUS.OK || Boolean(qr.code),
          ocr, qr,
          error: kind === 'qr'
            ? (qr.code ? null : 'No QR code could be read from this image.')
            : ocr.status === OCR_STATUS.OK ? null : (OCR_STATUS_MESSAGES[ocr.status] || 'No usable label information found.'),
        };
      } catch (error) {
        return { index, filename: file.filename, kind, success: false, ocr: null, qr: null, error: 'This image could not be processed.' };
      }
    }));

    const medicineImageResults = imageResults.filter((result) => result.kind === 'medicine');
    // If text extraction itself broke (timeout / engine error) for EVERY image, the honest
    // outcome is a processing failure — not a "no medicine information detected" result,
    // which would wrongly read as a statement about the package.
    if (medicineImageResults.every((result) => result.ocrError && !result.qr?.code)) {
      throw Object.assign(new Error('Text extraction is temporarily unavailable. Please try again in a moment.'), { status: 503, code: 'OCR_UNAVAILABLE' });
    }

    const successful = imageResults.filter((result) => result.success);
    const successfulOcr = medicineImageResults.filter((result) => result.ocr?.status === OCR_STATUS.OK);
    const first = (key) => medicineImageResults.map((result) => result.ocr?.[key]).find((value) => value && String(value).trim()) || null;
    const unique = (values) => [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
    const ocrTexts = unique(medicineImageResults.map((result) => result.ocr?.rawText));
    const qrCodes = settings.system.qrVerificationEnabled ? unique(imageResults.map((result) => result.qr?.code)) : [];
    const ocr = {
      status: successfulOcr.length ? OCR_STATUS.OK : OCR_STATUS.NO_TEXT_DETECTED,
      medicineName: first('medicineName'), genericName: first('genericName'), strength: first('strength'), manufacturer: first('manufacturer'),
      batchNumber: first('batchNumber'), manufacturingDate: first('manufacturingDate'), expiryDate: first('expiryDate'),
      consistent: successfulOcr.length > 0 && successfulOcr.every((result) => result.ocr?.consistent !== false && (result.ocr?.confidence == null || result.ocr.confidence >= 0.6)),
    };
    const extractedFields = Object.fromEntries(VERIFICATION_FIELDS.map((field) => [field, ocr[field]]));
    const { fields: finalFields, fieldSources } = mergeConfirmedFields(ocr, confirmedFields);
    Object.assign(ocr, finalFields);
    const fieldNames = ['medicineName', 'genericName', 'strength', 'manufacturer', 'batchNumber', 'manufacturingDate', 'expiryDate'];
    const normalizedFields = Object.fromEntries(fieldNames.map((field) => [
      field,
      ocr[field] ? String(ocr[field]).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-US') : null,
    ]));
    const fieldConflicts = Object.fromEntries(fieldNames.map((field) => {
      const values = [...new Set(medicineImageResults
        .map((result) => result.ocr?.[field])
        .filter(Boolean)
        .map((value) => String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-US')))];
      return [field, values.length > 1 ? values : null];
    }).filter(([, values]) => values));
    if (Object.keys(fieldConflicts).length) ocr.consistent = false;
    // Why each field is empty (NOT_DETECTED / UNREADABLE / INVALID) — best evidence across all images.
    const STATUS_RANK = { DETECTED: 4, INVALID: 3, UNREADABLE: 2, NOT_DETECTED: 1 };
    const fieldStatus = Object.fromEntries(fieldNames.map((field) => [
      field,
      medicineImageResults.map((result) => result.ocr?.fieldStatus?.[field]).filter(Boolean).sort((x, y) => STATUS_RANK[y] - STATUS_RANK[x])[0] || 'NOT_DETECTED',
    ]));
    if (confirmedFields) {
      for (const field of Object.keys(confirmedFields)) fieldStatus[field] = 'USER_CONFIRMED';
    }
    const assigned = new Set([ocr.manufacturingDate, ocr.expiryDate].filter(Boolean).map((value) => String(value).toUpperCase()));
    const unassignedDates = [...new Map(medicineImageResults.flatMap((result) => result.ocr?.unassignedDates || [])
      .filter((entry) => !assigned.has(String(entry.raw).toUpperCase()))
      .map((entry) => [entry.raw, entry])).values()];
    const ocrDetails = {
      rawText: imageResults.map((result) => result.ocr?.rawText ?? null),
      normalizedText: imageResults.map((result) => result.ocr?.normalizedText ?? null),
      fields: ocr,
      extractedFields,
      confirmedFields,
      fieldSources,
      normalizedFields,
      fieldConfidences: Object.fromEntries(fieldNames.map((field) => [
        field,
        medicineImageResults.map((result) => result.ocr?.fieldConfidence?.[field]).find((value) => typeof value === 'number') ?? null,
      ])),
      fieldStatus,
      unassignedDates,
      fieldConflicts,
    };
    stage('ocr', 'done');

    console.info('[Verification OCR]', { requestId, imageCount: files.length, successfulImages: successful.length });

    // ---- Medicine identification: local MediTrust database ---------------
    stage('identification', 'active');
    const { medicineMatch, medicineIdentification } = await identifyMedicine(ocr);
    stage('identification', 'done');

    // ---- Batch ------------------------------------------------------------
    stage('batch', 'active');
    const batch = await checkBatch(ocr.batchNumber);
    // A batch matching a real DB record is not proof it belongs to the SAME
    // medicine identified from the label — flag real inconsistency.
    const medicineConsistency = checkBatchMedicineConsistency(batch, medicineMatch.medicine);
    stage('batch', 'done');

    // ---- QR / barcode -----------------------------------------------------
    stage('qr', 'active');
    const qr = await classifyQrCodes(qrCodes);
    stage('qr', 'done', qrCodes.length ? undefined : 'No QR detected');

    // ---- Reference packaging: APPROVED references only --------------------
    stage('reference', 'active');
    const packagingMedicineId = batch.medicineId || (medicineMatch.status === 'MATCH' ? medicineMatch.medicine?._id : null);
    const packagingThresholds = { match: settings.risk.packagingMatchMin, partial: settings.risk.packagingPartialMin };
    const candidates = await Promise.all(successful.filter((result) => result.kind === 'medicine').map((result) => analyzeAgainstApprovedReferences(files[result.index].path, packagingMedicineId, packagingThresholds)));
    const packaging = candidates.filter((result) => typeof result.similarity === 'number').sort((x, y) => y.similarity - x.similarity)[0]
      || candidates[0]
      || { similarity: null, status: 'PACKAGING_NOT_AVAILABLE', source: 'UNAVAILABLE', referenceCount: 0, referenceAvailable: false };
    stage('reference', 'done', packaging.referenceAvailable ? undefined : 'No approved reference images');

    // ---- Duplicate detection ---------------------------------------------
    stage('duplicate', 'active');
    // A MANUFACTURER_QR_TRUSTED code is printed on every unit a manufacturer sells, so scanning
    // it repeatedly is normal and says nothing about cloning. Only codes that are meant to be
    // unique (batch-level or unknown) are checked for repeated-scan activity.
    const duplicateKey = qr.status === 'MANUFACTURER_QR_TRUSTED' ? null : qr.code;
    const duplicate = await checkDuplicateActivity({ qrCode: duplicateKey }, { threshold: settings.risk.duplicateThreshold, windowMinutes: settings.risk.duplicateWindowMinutes });
    stage('duplicate', 'done');

    // ---- Existing Risk Engine --------------------------------------------
    stage('risk', 'active');
    const expiry = validateExpiry(ocr.expiryDate);
    const signals = { qr: { ...qr, codes: qrCodes }, batch, ocr: { consistent: ocr.consistent }, packaging, duplicate, expiry, medicineConsistency };
    const assessment = assessVerification({
      medicineMatch, batch, qr, packaging, expiry, manufacturingDate: ocr.manufacturingDate, duplicate,
      ocr: { ...ocr, fieldStatus }, medicineConsistency,
      verifiedMin: settings.risk.verifiedMinConfidence, weights: weightsFromSettings(settings.risk),
    });
    const riskScore = assessment.score; // null when essential inputs were unavailable
    const riskLevel = riskLevelFromScore(riskScore, { lowRiskMin: settings.risk.lowRiskMin, mediumRiskMin: settings.risk.mediumRiskMin });
    const verificationStatus = assessment.status;
    stage('risk', 'done');

    const failed = imageResults.filter((result) => !result.success);
    // Issues shown to the user come from the engine's own reasons so the two can never disagree.
    const issues = assessment.reasons.map((reason) => reason.message);
    console.info('[Verification decisions]', { requestId, riskScore, verificationStatus, identificationSource: medicineIdentification.source });
    if (failed.length) issues.push(`${successful.length} of ${files.length} images processed successfully; ${failed.length} could not be read.`);

    stage('result', 'active');
    if (ctx.aborted) throw new TimeoutError('Verification', env.limits.verificationTimeoutMs);
    const scan = await Scan.create({
      userId: req.user.id, requestId, ocr: ocrDetails, medicineName: orNotDetected(ocr.medicineName), genericName: ocr.genericName, strength: ocr.strength,
      manufacturer: orNotDetected(ocr.manufacturer), batchNumber: orNotDetected(ocr.batchNumber, 'N/A'),
      manufacturingDate: orNotDetected(ocr.manufacturingDate, 'N/A'), expiryDate: orNotDetected(ocr.expiryDate, 'Expiry date could not be verified'),
      confirmedFields,
      imageReference: `/uploads/${files[0].filename}`, imageReferences: files.map((file) => `/uploads/${file.filename}`),
      imageResults: imageResults.map(({ ocr: imageOcr, qr: imageQr, ...result }) => ({ ...result, ocr: imageOcr ? { status: imageOcr.status, medicineName: imageOcr.medicineName, manufacturer: imageOcr.manufacturer, batchNumber: imageOcr.batchNumber, manufacturingDate: imageOcr.manufacturingDate, expiryDate: imageOcr.expiryDate, confidence: imageOcr.confidence, fieldConfidence: imageOcr.fieldConfidence, normalizedFields: imageOcr.normalizedFields, fieldStatus: imageOcr.fieldStatus, unassignedDates: imageOcr.unassignedDates } : null, qr: imageQr ? { code: imageQr.code } : null })),
      ocrTexts, evidence: assessment.checks, assessment, verificationStatus, riskScore, riskLevel, signals, medicineIdentification, detectedIssues: issues,
    });
    scanPersisted = true;
    stage('result', 'done');
    return scan;
  };

  try {
    const scan = await withTimeout(pipeline(), env.limits.verificationTimeoutMs, 'Verification', () => { ctx.aborted = true; });
    finishJob(jobId, { scanId: scan._id });
    return res.status(201).json({ success: true, requestId, verificationId: String(scan._id), scan: toClientScan(scan, req) });
  } catch (err) {
    ctx.aborted = true;
    const timedOut = err instanceof TimeoutError;
    const code = timedOut ? 'VERIFICATION_TIMEOUT' : (typeof err.code === 'string' && /^[A-Z_]+$/.test(err.code) ? err.code : 'PROCESSING_FAILED');
    const publicMessage = timedOut
      ? 'Verification took too long and was stopped. Please try again with clearer or fewer photos.'
      : (err.status && err.status < 500 ? err.message : 'Verification failed. Please try again.');
    finishJob(jobId, { failed: true, error: { code, message: publicMessage } });
    console.error(`[Verification] failed requestId=${requestId} code=${code}:`, err.message);
    if (!scanPersisted) await removeFailedUploads(files);
    if (timedOut) throw Object.assign(new Error(publicMessage), { status: 504, code: 'VERIFICATION_TIMEOUT' });
    throw err;
  } finally {
    releaseSlot();
  }
});

// Real stage-by-stage progress for the processing page.
export const getVerificationProgress = asyncHandler(async (req, res) => {
  const job = getJob(req.params.jobId, req.user.id);
  if (!job) return res.status(404).json({ success: false, code: 'JOB_NOT_FOUND', message: 'No progress found for this job.', requestId: req.id });
  return res.status(200).json(job);
});

export const getVerificationById = asyncHandler(async (req, res) => {
  const scan = await Scan.findById(req.params.id);
  if (!scan) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Verification result not found.', requestId: req.id });
  }

  const isOwner = String(scan.userId) === req.user.id;
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You do not have access to this result.', requestId: req.id });
  }

  return res.status(200).json({ success: true, requestId: req.id, verificationId: String(scan._id), scan: toClientScan(scan, req) });
});

export { toClientScan };
