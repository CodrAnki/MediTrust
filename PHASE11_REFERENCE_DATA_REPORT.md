# Phase 11 — Reference-Data Completion for Remaining Medicines

Follow-up to `PHASE10_REFERENCE_DATA_REPORT.md` and
`PHASE10_DEMO_COMPLETION.md`. Scope: make the reference data for
Palzit-DSR, ZOXFER-XT PLUS, "Zovivast-AQ" / Zovifast-AQ, and Safezyme
Syrup as complete as Zoxvitaz-L's, using only what `medicine.pdf`
actually shows. **No verification/matching/scoring code was changed.**

## 0. Environment limitation — please read first

This pass was done in a sandboxed environment with **no network access**
and **no MongoDB instance**. That means:
- `npm install` could not be run (no `node_modules` in this ZIP, same as
  the Phase 10 handoff).
- The seed scripts below have been **syntax-checked** (`node --check`)
  but **not executed against a real database**.
- The verification-score predictions in §7 were computed by extracting
  the pure scoring logic (`riskEngine.js`, which has zero external
  imports) and running it in isolation with realistic OCR-output
  assumptions — the same "computed, not asserted" approach used in
  `PHASE10_DEMO_COMPLETION.md`. They are estimates, not a live pipeline
  run.

**Before trusting these numbers, please run it yourself:**
```bash
cd server
npm install
npm run seed:reference          # upserts the 5 Medicine records (§2)
npm run seed:demo-batch         # Zoxvitaz-L batch — unchanged
npm run seed:remaining-batches  # the 4 new Batch records (§4)
# then scan a real photo of each product through your running API/UI
```

## 1. Files changed

**Current workspace image check:** the only packaged reference images present
are three `ref-*` photos of ZOXFER-XT PLUS. The expected reference files for
Zoxvitaz-L, Palzit-DSR, Zovifast-AQ and Safezyme Syrup are not present, so a
fresh seed cannot create packaging references for those medicines. The existing
ZOXFER-XT PLUS front-panel photo is now the seed image for that record; the
other photos remain in `server/reference-images/` under their existing names
so any database references to them keep working.

- **Modified:** `server/seedReferenceData.js` — rewritten with complete
  data for Zoxvitaz-L (unchanged), Palzit-DSR, ZOXFER-XT PLUS,
  Zovifast-AQ, Safezyme Syrup. "Zovivast-AQ" deliberately removed from
  the upsert list (see §3) — this does **not** delete or modify the
  existing DB record, it just stops touching it.
- **Added:** `server/seedRemainingBatches.js` — new Batch records for
  Palzit-DSR, ZOXFER-XT PLUS, Zovifast-AQ, Safezyme Syrup.
- **Added:** `server/reference-images/palzit-dsr-reference.jpg`,
  `zoxfer-xt-plus-reference.jpg`, `zovifast-aq-reference.jpg`,
  `safezyme-syrup-reference.jpg` — real, unedited photos taken directly
  from `medicine.pdf`'s embedded images (native ~1080×1925 resolution,
  only format-converted to `.jpg`, never cropped/synthesized/relabeled).
- **Modified:** `server/package.json` — added
  `"seed:remaining-batches": "node seedRemainingBatches.js"`.
- **Not touched:** `ocrService.js`, `riskEngine.js`,
  `medicineMatchService.js`, `batchService.js`, `qrService.js`,
  `packagingService.js`, `duplicateService.js`, any controller, any
  route, any frontend file, `seedDemoBatch.js`, `Medicine.js`,
  `Batch.js`.

## 2. Medicine fields added/updated

| Field | Zoxvitaz-L | Palzit-DSR | ZOXFER-XT PLUS | Zovifast-AQ | Safezyme Syrup |
|---|---|---|---|---|---|
| medicineName | (unchanged) | Palzit-DSR | ZOXFER-XT PLUS | Zovifast-AQ *(new record)* | Safezyme Syrup |
| manufacturer | (unchanged) | Zoxvina Biotech Pvt. Ltd. | Zoxvina Biotech Pvt. Ltd. | Zoxvina Biotech Pvt. Ltd. | Best Biotech |
| genericName | (added — composition) | Pantoprazole 40mg + Domperidone 30mg combo | Ferrous Bisglycinate 60mg + Zinc + Folic Acid + Methylcobalamin | Diclofenac Sodium Injection IP | Digestive enzyme syrup composition |
| composition | — | — | Ferrous Bisglycinate I.P. 60mg + Zinc Bisglycinate I.P. 15mg + Folic Acid I.P. 1mg + Methylcobalamin I.P. 500mcg | — | — |
| strength / dosage form | *not set (combo)* | *not set (combo — see §5)* | 60mg + 15mg + 1mg + 500mcg / Tablets | **75mg** / Injection | *not set (combo)* |
| pack size / MRP | — | — | 10 x 15 Tablets / ₹215 per 15 tablets | — | — |
| description | Mfd. by: Ultra Drugs (Unit-II) | *not needed — Zoxvina Biotech mfrs it directly* | Manufactured for Zoxvina Biotech; Mfd. by J.M. Laboratories, Solan (H.P.); MRP inclusive of taxes | Mfd. by: Ultra Drugs Pvt. Ltd., Baddi | Mfg. by: Sun Biotec |
| image | zoxvitaz-l-DEMO-reference.jpg *(missing in current workspace)* | palzit-dsr-reference.jpg *(missing)* | ref-1792121366539-4e73795dab5a.jpeg | zovifast-aq-reference.jpg *(missing)* | safezyme-syrup-reference.jpg *(missing)* |

All of the above are read directly off the packaging in `medicine.pdf` —
none are invented. See §6 for exactly which PDF page each came from.

## 3. "Zovivast-AQ" vs "Zovifast-AQ" — please review this

The existing database has a Medicine record named **"Zovivast-AQ"**
(manufacturer Zoxvina Biotech Pvt. Ltd., no other fields — evidently a
placeholder from before Phase 10).

**All 21 pages of `medicine.pdf` were visually inspected at native
embedded-image resolution** (not just thumbnails). There is no product
named "Zovivast-AQ" anywhere in the source. There **is** a different,
clearly-labeled product: **"Zovifast-AQ"** — Diclofenac Sodium Injection
IP, 10×1ml ampoules — legible at full resolution directly off the box
art (not inferred/guessed).

"Zovifast" and "Zovivast" differ in their 4th letter (f vs v). Per your
explicit instruction — *"Check carefully whether Zovivast-AQ is actually
present... If it is not supported by the PDF, DO NOT invent its
details"* — this pass:
- **Did not** add any composition/batch/QR/image data to the existing
  "Zovivast-AQ" record. It is completely untouched by
  `seedReferenceData.js` — re-running the script will not modify or
  delete it.
- **Added a new, separate** Medicine record for "Zovifast-AQ" with real
  data from the PDF.

**This needs a human decision**, not a script's guess: was "Zovivast-AQ"
a typo for this real product, a different real product with no photo in
this batch, or leftover test data? I'd recommend checking with whoever
entered "Zovivast-AQ" originally before deciding whether to rename,
deactivate (`active: false`), or delete that record.

## 4. Batch / QR evidence

| Medicine | Batch No. | Mfg. Date | Expiry Date | MRP | Confidence | QR |
|---|---|---|---|---|---|---|
| Zoxvitaz-L | US-25361A | 12/2025 | 11/2027 | — | High (unchanged from Phase 10) | Shared marketing QR only; no per-batch QR stored |
| Palzit-DSR | 25LC019F | 12/2025 | 11/2027 | ₹104/10 caps | **High** — identical stamp on 3 independent photos (PDF pages 2, 10, 20) | Shared manufacturer QR; no per-batch QR stored |
| ZOXFER-XT PLUS | GT28624F | 10/2025 | 03/2027 | ₹215/15 tablets | **Moderate** — fine dot-matrix print, appears on only 1 photo (page 12); "8" read with reasonable but not certain confidence against a "B"-shaped alternative. **Please confirm against a physical unit.** | Shared manufacturer QR; no per-batch QR stored |
| Zovifast-AQ | UGA-2693B | 03/2026 | 02/2028 | ₹21.30/ampoule | High — clear print, single photo (page 15) but unambiguous characters | No verified per-batch QR stored |
| Safezyme Syrup | SZ-2618 | 02/2026 | 07/2027 | ₹144.18 | High — clear print (page 18) | No QR observed on this box at all |

**No genuine per-batch QR payload exists for any of these products.**
The only QR code found on any package (confirmed by an independent real
decode this pass, on the Palzit-DSR box) decodes to
`https://zoxvinabiotech.com/` — a static marketing URL shared across the
whole product line, not a batch-specific code. Storing that shared
string as any one batch's `qrCode` would make a scan of a *different*
product falsely "MATCH" that batch, so — exactly as Phase 10 did for
Zoxvitaz-L — each new Batch record gets an obviously-fake
`DEMO-NO-QR-<batchNumber>` placeholder purely to satisfy the schema's
`required`/`unique` constraint. `qrService.js` was not touched and only
ever compares against a real decode of real image pixels, so this
placeholder can never be produced by an actual scan.

## 5. Why `strength` is left blank for the combo products

`medicineMatchService.js` treats a strength mismatch as a hard block:
`strengthMatches` must be true (or absent) for a `MATCH`. Palzit-DSR,
ZOXFER-XT PLUS, Safezyme Syrup, and Zoxvitaz-L are all multi-ingredient
combination products with several different doses on the label (e.g.
Palzit-DSR is Pantoprazole 40mg *and* Domperidone 30mg). Picking either
number as "the" strength would be an arbitrary, not a genuine, fact —
and if real OCR ever extracts the *other* ingredient's dose from a future
photo, a wrongly-populated `strength` field would cause a false
MISMATCH on an otherwise-genuine package. This field is left unset for
those four, consistent with the instruction not to weaken or distort
matching just to raise a score. Zovifast-AQ has exactly one active
ingredient (Diclofenac Sodium 75mg), so its one real value is stored.

## 6. Field-by-field source map (medicine.pdf page → field)

| Page(s) | Medicine | What's shown |
|---|---|---|
| 1, 8, 19 | Palzit-DSR | Front panel — name, composition text, pack size (10x10 Capsules) |
| 2, 10, 20 | Palzit-DSR | Back panel — Batch No. 25LC019F, Mfg Dec-2025, Exp Nov-2027, MRP ₹104/10 caps, QR code (decoded this pass), Zoxvina Biotech address |
| 9 | Palzit-DSR | Side panel — full composition (Pantoprazole 40mg + Domperidone 30mg), "Mfd. in India by: Zoxvina Biotech Pvt. Ltd." |
| 21 | Palzit-DSR | Side panel (repeat) — same composition/manufacturer confirmation |
| 3, 5 | Zoxvitaz-L | Front panel (unchanged from Phase 10) |
| 4, 7 | Zoxvitaz-L | Back panel — batch data (unchanged from Phase 10) |
| 6 | Zoxvitaz-L | Side panel — full composition, "Mfd. by: Ultra drugs Pvt. Ltd." (unchanged) |
| 11 | ZOXFER-XT PLUS | Front panel — name, composition text, pack size (10x15 Tablets) |
| 12 | ZOXFER-XT PLUS | Back panel — Batch No. GT28624F (moderate confidence, see §4), Mfg Oct-2025, Exp Mar-2027, MRP ₹215/15 tabs, "Manufactured for: Zoxvina Biotech Pvt. Ltd." |
| 13 | ZOXFER-XT PLUS | Side panel — full composition (Ferrous Bisglycinate 60mg, Zinc Bisglycinate 15mg, Folic Acid 1mg, Methylcobalamin 500mcg), "Manufactured by: J.M. Laboratories, Solan (H.P.)" |
| 14 | Zovifast-AQ | Front panel — name ("Zovifast-AQ", not "Zovivast-AQ"), Diclofenac Sodium Injection IP, pack size (10x1ml Ampoules) |
| 15 | Zovifast-AQ | Back panel — full composition (Diclofenac Sodium 75mg), Batch No. UGA-2693B, Mfg 03/2026, Exp 02/2028, MRP ₹21.30/ampoule, "Mfd. by: Ultra Drugs Pvt. Ltd." + "Manufactured for: Zoxvina Biotech Pvt. Ltd." |
| 16, 17 | Safezyme Syrup | Front panel — name, "Digestive Enzyme Syrup", "Sugar Free", 200ml, "Best Biotech" |
| 18 | Safezyme Syrup | Side panel — Batch No. SZ-2618, Mfg Feb-2026, Exp Jul-2027, MRP ₹144.18, ingredients (Fungal Diastase, Papain), "Marketed by: Best Biotech", "Mfg by: Sun Biotec" |

## 7. Predicted verification results (computed, not a live run — see §0)

Using the real `riskEngine.assessVerification()` logic with realistic
OCR-output assumptions for each product (front+back panel text a real
Tesseract pass would plausibly extract):

| Medicine | Identity | Manufacturer | Batch | Predicted score | Predicted status |
|---|---|---|---|---|---|
| Palzit-DSR | MATCH ~100% | MATCH ~100% | MATCH (100%) | **~96.4** | VERIFIED / low risk |
| ZOXFER-XT PLUS | MATCH ~100% | MATCH ~100% | MATCH (100%) | **~96.4** | VERIFIED / low risk |
| Zovifast-AQ | MATCH ~100% | MATCH ~100% | MATCH (100%) | **~96.4** | VERIFIED / low risk |
| Safezyme Syrup | MATCH ~100% | MATCH ~100% | MATCH (100%) | **~96.4** | VERIFIED / low risk |

(Packaging assumed at a conservative ~60% partial-match, same
assumption Phase 10 used for Zoxvitaz-L, since these are casual sample
photos rather than studio shots; QR assumed NOT_DETECTED/excluded, same
as Zoxvitaz-L, since none of these have a genuine per-batch QR.)

For comparison, the **pre-Phase-11 state** (Medicine record only, no
Batch, no reference image) computes to **~86.2, status HIGH_CONFIDENCE**
— not a failure, but capped below `VERIFIED` because `batch.verified`
was never `true` and `packaging` was excluded entirely for lack of a
reference image. The gap was a genuine reference-data gap (no Batch
document, no photo on file), exactly as it was for Zoxvitaz-L before
Phase 10 — not an OCR or scoring defect.

## 8. Remaining limitations

- **Not run against a live database or a live OCR pass** — see §0.
  Please run the commands there and treat §7's numbers as a prediction
  to verify, not a guarantee.
- **ZOXFER-XT PLUS batch number (GT28624F)** has only moderate
  confidence — see §4. Please confirm against a physical unit.
- **"Zovivast-AQ" needs a human decision** — see §3. Nothing was deleted
  or guessed, but someone should decide what that record should become.
- **Packaging similarity is unmeasured** for the 4 new reference images
  until real uploaded photos are compared against them — the ~60%
  assumption in §7 is carried over from the Zoxvitaz-L precedent, not
  measured for these specific images.
- **QR codes were not individually re-decoded for every new box** — the
  Palzit-DSR QR was independently decoded this pass and confirmed
  identical to the Zoxvitaz-L finding; the others are assumed to be the
  same shared marketing QR based on the identical branding/layout, not
  each individually re-verified pixel-by-pixel.
- No changes were made to `Medicine.js` or `Batch.js` schemas, per
  instructions — `genericName`/`strength` above use fields that already
  existed but were previously always empty.
