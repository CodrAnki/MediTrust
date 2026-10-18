# MediTrust — Audit and Phase 1 Report

Scope of this report: the repository audit, and **Phase 1** (repair the verification workflow) plus the one
**Phase 2** defect that proved to be blocking (batch/date extraction). Phases 3–7 are NOT done; see §5.

## 1. What was audited

Read in full: `server/app.js`, `server.js`, `config/env.js`, `routes/*` (verification, scans, admin), `controllers/verificationController.js`,
`scanController.js`, `dashboardController.js`, `services/{ocrService,riskEngine,qrService,batchService,duplicateService,progressService,medicineIdentificationService}.js`,
`middleware/{upload,authMiddleware,rateLimiter,errorHandler}.js`, `utils/{expiry,jwt}.js`, models (`Scan, Medicine, Batch, ManufacturerQr, ReferenceImage, User`), `seed/referenceData.js`, `dataSeed.js` (first half),
client `App.jsx`, `main.jsx`, `Verify.jsx`, `VerifyProcessing.jsx`, `VerifyResult.jsx`, `VerificationContext.jsx`, `services/{api,verificationService}.js`, `verificationRecord.js`, `ProcessingSteps.jsx`.

**Skimmed or not read** (their phases must start with a proper read): `packagingService.js`, `referenceImageService.js` (analysis), `qrDecoder.js`, `medicineMatchService.js`,
admin controllers, auth/OTP services, `Dashboard.jsx`, `ScanHistory.jsx`, `EvidencePanel.jsx`, admin pages.

## 2. Baseline (before any change)

| Check | Result |
|---|---|
| `npm test` (server) | 90 pass, DB integration suites skipped (no MongoDB) |
| DB integration suites | 12 pass against FerretDB 1.24 (SQLite) — see caveat §6 |
| client `lint` / `build` | 0 errors, 18 warnings / builds |
| Client tests | none existed |

## 3. Verified defects (found by running the code, not by inspection alone)

| # | Defect | Evidence | Status |
|---|---|---|---|
| D1 | **Expiry date returned as the batch number**; bogus MFG `2027`; expiry `null` | Real fixture run: batch=`MAR-2027`. Box actually prints batch `GT28624F`, MFG `OCT-2025`, EXP `MAR-2027`; Tesseract cannot read the dot-matrix batch/MFG | **Fixed** |
| D2 | Progress polling (≈2 req/s) shared the 300/15 min general limiter → processing page stalled or the upload got 429 | `app.js`/`rateLimiter.js`; reproduced by mutation test | **Fixed** |
| D3 | A failed Tesseract start was cached forever (rejected promise) | `ocrService.getWorker` | **Fixed** |
| D4 | `recognize()` had no timeout; one hang blocked the shared queue = every later verification hung | `ocrService.runTesseract` | **Fixed** |
| D5 | No request timeout anywhere (client or pipeline) | `api.js`, controller | **Fixed** |
| D6 | No guard against double-submit / parallel runs per user | controller | **Fixed** |
| D7 | Processing page: no retry, error dead-end, lost-response not recovered, result id not validated | `VerifyProcessing.jsx` | **Fixed** |
| D8 | Bare year `2027` expiry parsed as January → false "EXPIRED" | `utils/expiry.js` | **Fixed** |
| D9 | `shutdownOcrWorker()` existed but was never called; Node could not exit | test run hung | **Fixed** |
| D10 | Error bodies had no trace id and inconsistent shape | `errorHandler.js` | **Fixed** |

## 4. Defects found, NOT yet fixed (carry into later phases)

| # | Defect | Phase |
|---|---|---|
| O1 ✅ fixed in Phase 4 | **A scan with no readable batch and no readable expiry can still get `HIGH_CONFIDENCE`** (QR + name + manufacturer carry it). Unavailable ≠ verified; this violates the status rules. Needs the status contract rewrite. | 4 |
| O2 ✅ fixed in Phase 4 | Risk numeric score is always shown, even when essential inputs are unavailable | 4 |
| O3 ✅ fixed in Phase 4 | Status vocabulary is not the requested contract (`SUSPICIOUS/HIGH_RISK/HIGH_CONFIDENCE/UNVERIFIED` vs `MISMATCH_DETECTED/NEEDS_REVIEW/...`) | 4 |
| O4 | `Batch.batchNumber` is **globally unique** — two manufacturers can legitimately reuse a batch string. Should be unique per `(medicineId, batchNumber)`. Needs a migration + backup. | 2 |
| O5 | Dates stored as strings (`"MM/YYYY"`) | 2 |
| O6 | Seed marks everything `source:'seed'` and auto-**approves** seeded reference images; no demo-vs-trusted flag | 2 |
| O7 | Not-detected values are stored as display sentinels (`"N/A"`, `"Expiry date could not be verified"`) mixed into data fields | 2/4 |
| O8 | No OCR correction workflow; `Z0XFER` (zero) is shown as read | 2 |
| O9 | Uploaded photos served publicly from `/uploads` without auth; no retention policy | 7 |
| O10 | Raw decoded QR is stored and rendered in results; no GS1 parsing; no 1D barcode decoder | 3 |
| O11 | Repeated-scan check is per-QR only; no duplicate-alert review queue | 6 |
| O12 | No suspicious-report feature, no report model | 6 |
| O13 | `.env` files with what look like real values (Mongo URI, SMTP password, admin password) were inside the uploaded zip. **Rotate them.** They are excluded from the delivered archive. | now |

## 5. Phase status

| Phase | Status |
|---|---|
| 1 Audit + workflow repair | **Done** (this report) |
| 2 OCR / reference data / batch validation | **Partial**: D1, D8 fixed, field statuses (`DETECTED/NOT_DETECTED/UNREADABLE/INVALID`) added. O4–O8 open |
| 3 QR/barcode + packaging | Not started |
| 4 Risk engine + status contract | **Done** (see §8) |
| 5 UI redesign / result page | Not started |
| 6 History, admin, reports | Not started (history ownership is covered by a passing test) |
| 7 Security, tests, docs | Not started |

## 6. Test evidence (actually run)

* Server: **161 tests, 0 fail, 0 skipped**, process exits cleanly (`node --test --test-concurrency=1 tests/*.test.js` with `TEST_MONGO_URI` set).
* New: `labelParser` (incl. the real captured Tesseract output), `progressService`, `timeout`, `apiEnvelope` (rate limit + error shape), `expiry` additions, and `verificationFlow.integration` (real Express app + real OCR + DB: envelope, ownership 403s, duplicate 409, concurrent 409, 504 timeout, no late persistence).
* The rate-limit regression test was checked by mutation: it fails with the fix removed, passes with it.
* Client: 17 vitest tests for `verificationService` (real stage forwarding, 429 backoff, **lost-response recovery**, error mapping, no internals leaked). `lint` 0 errors / 18 pre-existing warnings; `build` OK.

**Caveats — please read**
* The DB tests ran on **FerretDB 1.24 (SQLite)**, MongoDB-compatible but not MongoDB Atlas. Run them once on real MongoDB.
* No browser test: the processing/result **components were not rendered** in any test (no jsdom/RTL installed). Their logic is in the tested service, but navigation is unverified in a browser.
* OCR early-exit for upright photos is implemented but **not measured**; both fixtures are legitimately slow (8–10 s per image, sideways/unreadable).
* On the fixture the pipeline still returns `HIGH_CONFIDENCE` (defect O1).

## 7. API contract introduced in Phase 1

Success: `{ success: true, requestId, verificationId, scan }` (`scan` kept for backward compatibility).
Error: `{ success: false, code, message, requestId }` — codes: `NO_IMAGE, TOO_MANY_IMAGES, FILE_TOO_LARGE, VERIFICATION_IN_PROGRESS (409), DUPLICATE_SUBMISSION (409), VERIFICATION_TIMEOUT (504), OCR_UNAVAILABLE (503), RATE_LIMITED, PROGRESS_RATE_LIMITED, VERIFICATION_RATE_LIMITED, NOT_FOUND, FORBIDDEN, INTERNAL_ERROR`.
Progress: `GET /api/verification/progress/:jobId` → `{ state: running|done|failed, scanId, stages, notes, error, requestId }`.
Header `X-Request-Id` on every response. New env: `OCR_TIMEOUT_MS`, `VERIFICATION_TIMEOUT_MS`, `VITE_VERIFY_TIMEOUT_MS`.

## 8. Phase 4 — risk engine v2 and status contract

**Statuses** (`server/services/riskEngine.js` → `STATUS`): `VERIFIED_AGAINST_REFERENCE, NEEDS_REVIEW, MISMATCH_DETECTED, EXPIRED, REFERENCE_NOT_FOUND, NOT_AVAILABLE, NOT_DETECTED, INVALID_INPUT, PROCESSING_FAILED`.
Old stored values are **not rewritten**. They are mapped for display/filtering (`LEGACY_STATUS`): `VERIFIED→VERIFIED_AGAINST_REFERENCE`, `HIGH_CONFIDENCE/SUSPICIOUS/UNVERIFIED/UNKNOWN→NEEDS_REVIEW`, `HIGH_RISK/MISMATCH→MISMATCH_DETECTED`. History and admin filters match both old and new values.

**Rules (each tested):** R1 missing evidence is unavailable, never a mismatch or support · R2 only a read value contradicting a trusted reference is a MISMATCH · R3 VERIFIED needs identity + manufacturer + batch matched to an ACTIVE trusted batch, a readable valid expiry, no flags, OCR not low-confidence, score ≥ `verifiedMinConfidence`; QR and packaging are never required · R4 EXPIRED always wins over "good" signals · R5 repeated scans, unknown QR, dissimilar packaging can only mean NEEDS_REVIEW · R6 the score is `null` when identity, batch or expiry could not be checked · R7 one underlying cause is scored once.

**Scan output** now has `assessment` (checks with scanned vs reference values, reasons, missing items, plain-language explanation, next steps, limitations, weights, engine version). `riskScore` is nullable and `riskLevel` may be `unknown`. Weights are configurable (`settings.risk.weight*`, admin → Risk Engine).
Also: unknown batch for a known medicine is UNKNOWN (not "fake"); fuzzy (O/0) batch matches need confirmation; printed expiry/MFG are compared with the registered batch dates; a batch QR belonging to a different batch than printed is a conflict.

**Tests run:** server **191 pass / 0 fail / 0 skipped** (incl. 33 engine tests, one sweeping **3,456 combinations** of outcomes for safety invariants, and the end-to-end flow now asserting NEEDS_REVIEW + withheld score on the Zoxfer box). Mutation check: weakening the "required check missing" rule fails 7 tests. Client: lint 0 errors / 18 warnings, build OK, 17 tests.

**Honest limits**
* `VERIFIED_AGAINST_REFERENCE` means agreement with *MediTrust's own records*. There is still no trusted-vs-demo flag on reference data (O6, Phase 2), so a demo record can currently produce it. Do not treat it as production-ready until O6 is done.
* Failed scans are still not persisted, so `INVALID_INPUT`/`PROCESSING_FAILED` exist in the contract but only appear as API errors for now (history handling is Phase 6).
* Existing records keep their old `riskScore`; no migration was run.
* The new result page and admin weight fields compile and lint but were **not rendered in a browser**.
* The "Report a suspicious medicine" step in `nextSteps` has no feature behind it yet (Phase 6).
