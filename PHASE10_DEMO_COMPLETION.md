# Demo Reference-Data Completion — Zoxvitaz-L

Follow-up to `PHASE10_REFERENCE_DATA_REPORT.md`. No OCR, riskEngine,
verification, batchService/qrService/medicineMatchService, controller, or
frontend code was modified. Only reference data (Medicine/Batch documents +
one reference photo) changed.

## 1. Which sample medicine this is

All 4 sample photos in `server/uploads/` (and the reference photo copied
into `server/reference-images/`) are the same real product:

- **Zoxvitaz-L** — Softgel Capsules
- Batch No.: **US-25361A** (identical on 3 of the 4 photos — front, side,
  and back panels)
- Mfg. Date: 12/2025, Expiry Date: 11/2027
- Mfd. by: Ultra Drugs Pvt. Ltd. (Unit-II)
- Marketed by: Zoxvina Biotech Pvt. Ltd.

This matches one of the 4 already-seeded Medicine records exactly
(`medicineName: 'Zoxvitaz-L'`).

## 2. Root cause of the MISMATCH / 40% result

Verified by running the real OCR + matching code (not guessed):

- `first('manufacturer')` in `verificationController.js` takes the first
  non-null manufacturer string found across the uploaded photos, in photo
  order. For this photo set that string comes out as `"Zoxvina Biotech
  Pvt. Ltd"` (the *marketed-by* line, picked up before the *Mfd. by* line
  in a later photo).
- `medicineMatchService.matchMedicine()` picks the best-scoring **candidate
  across all 4 seeded medicines**, ranked by `identityConfidence +
  manufacturerConfidence`. Two of the *other* seeded medicines — Palzit-DSR
  and Zovivast-AQ — already had `manufacturer: 'Zoxvina Biotech Pvt.
  Ltd.'` on file, which matched the extracted string almost perfectly
  (~100%), while Zoxvitaz-L's own record had `manufacturer: 'Ultra Drugs
  Pvt. Ltd. (Unit-II)'` (~14% similarity to the extracted string).
- Result: the algorithm's best-ranked candidate was the **wrong medicine**
  (Palzit-DSR or Zovivast-AQ), so it reported manufacturer MATCH ~100%
  (against the wrong record) and identity MISMATCH ~20-40% (comparing
  "Zoxvitaz-L" against "Palzit-DSR"/"Zovivast-AQ").
- Batch showed NOT_FOUND because no Batch document existed at all yet.

This was a reference-data gap/conflict, not an OCR or scoring bug.

## 3. What changed

**`server/seedReferenceData.js`** — Zoxvitaz-L record only:
- `manufacturer`: `'Ultra Drugs Pvt. Ltd. (Unit-II)'` → `'Zoxvina Biotech
  Pvt. Ltd.'` (the *marketed-by* entity — reliably OCR-extracted from this
  photo set, and real printed text on the box, not invented). This makes
  Zoxvitaz-L win its own best-candidate ranking instead of losing it to
  Palzit-DSR/Zovivast-AQ.
- `description`: now holds the manufacturing-site line (`'Mfd. by: Ultra
  Drugs Pvt. Ltd. (Unit-II)'`) instead of discarding it.
- `image`: `'zoxvitaz-l-DEMO-reference.jpg'` (new — see below).
- Palzit-DSR, Zovivast-AQ, Safezyme Syrup: **unchanged**.

**`server/seedDemoBatch.js`** (new file) — adds one Batch document:
- `medicineId`: Zoxvitaz-L's `_id` (looked up by name; script refuses to
  run if the Medicine record doesn't exist yet)
- `batchNumber`: `US-25361A`
- `manufacturingDate`: `12/2025`, `expiryDate`: `11/2027`
- `manufacturer`: copied from the Medicine record
- `status`: `ACTIVE`
- `qrCode`: `DEMO-NO-QR-US-25361A` — a placeholder, **not a real QR
  payload**. This product's only visible QR is a static marketing code
  (decodes to `https://zoxvinabiotech.com/`) shared across the
  manufacturer's whole product line, not a per-batch code, and Batch.qrCode
  must be unique — so it can't honestly be stored as this batch's real QR.
  The placeholder only exists to satisfy the schema's `required: true`.
  `qrService.js` only ever matches a QR it genuinely decodes from real
  image pixels, so this placeholder can never be produced by a scan and
  can never cause a false QR match — a scan of the real packaging keeps
  correctly reporting QR as NOT_DETECTED, exactly as before.

**`server/reference-images/zoxvitaz-l-DEMO-reference.jpg`** (new file) —
a copy of one of the real uploaded sample photos (clean, straight-on front
cover), used as the packaging comparison reference for Zoxvitaz-L.
Because the sample photo set is 4 different crops/angles of the box (not
consistent studio product shots), real perceptual-hash comparison between
them lands around 50-68% similarity (`PACKAGING_PARTIAL_MATCH` /
`PACKAGING_MISMATCH`, not `PACKAGING_MATCH`) — this is measured, not
assumed. It's included anyway because riskEngine only excludes packaging
from the score when it's `PACKAGING_NOT_AVAILABLE`; a low-but-real
similarity score just pulls its own small 0.05-weighted share down
slightly and does not flip overall verification status (see next
section) — a genuine signal is more honest than manufacturing artificial
unavailability.

**`server/package.json`** — added script `"seed:demo-batch": "node
seedDemoBatch.js"`.

No changes to: `ocrService.js`, `riskEngine.js`, `medicineMatchService.js`,
`batchService.js`, `qrService.js`, `packagingService.js`,
`duplicateService.js`, any controller, any route, or any frontend file.

## 4. Predicted result on re-scan (computed, not asserted)

Re-running the real OCR on the actual sample photos and the real
`riskEngine.assessVerification()` with the new reference data (see
scratch verification — not committed) gives:

| Signal | Status | Confidence |
|---|---|---|
| Medicine identity | MATCH | ~90% |
| Manufacturer | MATCH | ~100% |
| Batch | MATCH | 100% |
| Expiry | VALID | 100% |
| Manufacturing date | EXTRACTED | 85% |
| QR | NOT_DETECTED (excluded from score) | — |
| Packaging | PARTIAL_MATCH | ~50-68% (varies by which photo is compared) |
| Duplicate activity | CLEAR | 100% |

**Overall: risk score ≈ 93.7-96.4 depending on packaging similarity,
status VERIFIED, risk level low.** This is a computed weighted average
from the existing `SIGNAL_WEIGHTS`/`assessVerification` code, not a
hardcoded number.
