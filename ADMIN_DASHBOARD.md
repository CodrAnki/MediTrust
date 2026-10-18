# MediTrust admin dashboard

## Architecture
One system: React/Vite frontend + Express/MongoDB backend. The admin area manages the **same** collections the verification pipeline reads:

| Admin action | Used by verification |
|---|---|
| Add / import a medicine | Local medicine identification |
| Approve a reference image | Packaging similarity (approved + enabled images only) |
| Add a batch (+ QR / barcode) | Batch and QR verification, duplicate checks |
| Change risk thresholds | Existing Risk Engine / packaging / duplicate thresholds |

There is no demo data and no second verification path.

## Setup
```
cd server
cp .env.example .env        # fill MONGO_URI, JWT_SECRET, SUPER_ADMIN_NAME/EMAIL/PASSWORD (password >=10 chars)
npm install
npm run data:seed           # creates / promotes the super admin from SUPER_ADMIN_* AND seeds the reference data
npm run dev                 # backend
cd ../client && npm install && npm run dev
```
Admin login: `/admin/login`. Admin accounts are `User` documents with `role: "admin"` (no duplicate Admin model). Login is by email.

## Pages
`/admin` dashboard · `/admin/medicines` · `/admin/reference-images` · `/admin/batches` · `/admin/codes` · `/admin/verifications` · `/admin/users` · `/admin/risk-engine` · `/admin/settings` · `/admin/audit-logs`

## API (all under `/api/admin`, admin JWT required except login)
```
POST /auth/login   POST /auth/logout   GET /me
GET  /dashboard/stats
GET|POST /medicines   GET|PUT|DELETE /medicines/:id   GET /medicines/options
GET|POST /reference-images   PUT|DELETE /reference-images/:id
GET|POST /batches   GET|PUT|DELETE /batches/:id
GET /codes/check   GET|POST /manufacturer-qr   DELETE /manufacturer-qr/:id
GET /verifications  GET /verifications/:id          (read-only)
GET /users  GET /users/:id/history  PATCH /users/:id/active
GET /audit-logs
GET|PUT /risk-engine   GET|PUT /settings
```
Errors: `{ "success": false, "message": "..." }` — never stack traces, URIs or keys.

## Database changes
- `Medicine`: + brandName, composition, dosageForm, mrp, packSize, active and source provenance. Legacy external source fields are retained for existing records.
- `Batch`: + mrp, barcode (sparse unique).
- `User`: + isActive, lastLogin.
- `Scan` (the verification record): statuses extended (MISMATCH, UNKNOWN, NOT_DETECTED, NOT_AVAILABLE); `signals` now Mixed (expiry / medicineConsistency / qr codes were previously dropped by the strict sub-schema); + `medicineIdentification`.
- New: `ReferenceImage`, `AuditLog`, `Setting`.
- On startup, legacy `Medicine.image` values are migrated (idempotently) to approved `ReferenceImage` records with `source: "seed"`.

## Reference image workflow
Upload (JPG/JPEG/PNG/WEBP, ≤10 MB, up to 10 files) → extension + MIME + decode check → sha256 duplicate rejection → status **pending** (or approved if "approve on upload" is ticked) → Approve / Reject → Enable / Disable. Replacing a file resets it to pending. Files live in `server/reference-images/`; MongoDB stores URL, hash and metadata only.

## Verification workflow & statuses
Upload → OCR → local medicine DB → batch → QR → approved reference packaging → duplicates → Risk Engine → result.
Statuses: VERIFIED, HIGH_CONFIDENCE, SUSPICIOUS, HIGH_RISK, MISMATCH, UNKNOWN, REFERENCE_NOT_FOUND, NOT_DETECTED, NOT_AVAILABLE, EXPIRED (legacy `UNVERIFIED` still renders as Unknown). Mapping from the engine's internal result is in `toPublicStatus()` (`server/services/riskEngine.js`) and only relabels — an unknown medicine is never called fake.
Progress on `/verify/processing` is real: the server records each stage and the client polls `GET /api/verification/progress/:jobId`.

## Risk Engine
The Phase 7 engine is unchanged in logic and extended in place: configurable thresholds (low/medium risk, VERIFIED minimum, packaging match/partial, duplicate count/window) and a manufacturer "not available" state. Weights and decision logic are code, not settings.

## Security
bcrypt passwords; JWT; every admin route behind `requireAdmin` (server-side); inactive accounts rejected; login rate-limited and audit-logged (failures included, no passwords); strict input coercion (no object injection into queries) and whitelisted fields; upload type/size/integrity checks; no stack traces; secrets git-ignored. Logout is stateless (token discarded; it expires per `JWT_EXPIRES_IN`).

## Known limits
- 1D barcodes are stored/duplicate-checked but not decoded from photos (only QR is).
- Packaging similarity compares against all approved references of the identified medicine (capped at 6); for very large catalogues add embedding/vector candidate retrieval (the lookup is isolated in `referenceImageService.js`).
- OCR provider, similarity method, max upload and formats are shown read-only in Settings (they are code-level).

## Troubleshooting
- *Admin login says invalid*: re-run `npm run data:seed`; the account must have `role: admin` and `isActive`.
- *Packaging shows "Reference unavailable"*: the medicine has no **approved + enabled** reference image.
- *Images 404 in admin*: the API serves them at `/reference-images/<file>`; check `VITE_API_URL` host.
