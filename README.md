# MediTrust

MediTrust is a medicine-package verification and risk-assessment application. It consists of a React/Vite client, an Express API, and MongoDB persistence.

The result is a technology-assisted risk assessment, not a laboratory test, regulator approval, or guarantee that a medicine is genuine. A pharmacist or the manufacturer should be consulted when a result is uncertain or concerning.

## Current capabilities

- Email-verified account registration, login, and role-protected administration.
- Multi-image medicine verification (up to five JPG, PNG, or WEBP images, 10 MB each).
- Local Tesseract.js OCR with image preprocessing, structured package-field extraction, raw/normalized OCR text, overall confidence, and word-derived field-confidence estimates.
- A pre-verification review step shows extracted medicine fields and photo text, allows users to correct or fill in values, and uses their confirmed values for the final checks.
- QR decoding with `jsqr` and local classification against known manufacturer/batch records. A successful decode alone does not prove authenticity.
- Optional separate QR-photo upload, decoded and matched independently of medicine-label OCR.
- Local medicine and batch matching, expiry checks, duplicate-activity checks, and an explainable risk/status assessment.
- Deterministic packaging comparison against admin-approved reference images. It is unavailable when no approved reference exists; it is not an ML or regulatory check.
- Persisted verification history, per-user result access, real processing progress, and authenticated admin workflows.
- Admin tools for medicine, batch, reference-image, user, and verification management.

## Requirements

- Node.js supported by the installed Vite version (Node 20.19+ or 22.12+ recommended).
- MongoDB reachable by the API.
- SMTP credentials for registration email verification.

## Local development

Install dependencies in each app directory:

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Set the required values in `server/.env` before starting the API. At minimum, provide `MONGO_URI`, a random production-strength `JWT_SECRET`, `CLIENT_URL`, and working SMTP settings. To provision the initial admin through the seed script, set `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD` as well.

Then install and configure the client:

```powershell
cd ..\client
npm install
Copy-Item .env.example .env
```

Set `VITE_API_URL` to the API base URL (default: `http://localhost:5000/api`). Start the API and client in separate PowerShell windows:

```powershell
# server/
npm run dev

# client/
npm run dev
```

The Vite development server prints the client URL; by default it is `http://localhost:5173`. Set `CLIENT_URL` to that exact origin (or a comma-separated allowlist) in the server environment.

## Seed data

From `server/`, after configuring a reachable MongoDB and the super-admin credentials:

```powershell
npm run data:seed
```

The script seeds reference medicines/batches and creates or promotes the configured super admin. It is intended to be rerunnable, but review `server/dataSeed.js` and `server/seed/` before running it against a production database. This command has not been run as part of this documentation update.

## Tests and production build

```powershell
# Backend tests
cd server
npm test

# Client lint and production build
cd ..\client
npm run lint
npm run build
```

Lint may report warnings; review the command output instead of treating warnings as a clean pass. The production client output is written to `client/dist`.

## Environment configuration

### Server (`server/.env`)

Copy `server/.env.example` and configure:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Use `production` for deployment. |
| `PORT` | API listen port; defaults to `5000`. |
| `MONGO_URI` | MongoDB connection string. |
| `JWT_SECRET` | Random secret of at least 32 characters; mandatory in production. |
| `JWT_EXPIRES_IN` | Token lifetime; defaults to `7d`. |
| `CLIENT_URL` | Allowed client origin(s), comma-separated. |
| `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | Initial admin identity for the seed script. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP delivery for email OTP. Port 465 uses implicit TLS; port 587 uses STARTTLS. |

Never commit `.env` files or expose server secrets through `VITE_` variables. The server loads its own `.env` regardless of the launch directory. Production startup exits if `JWT_SECRET` is absent or too short.

### Client (`client/.env`)

Copy `client/.env.example`. `VITE_API_URL` must point to the deployed API's `/api` base path. `VITE_CONTACT_EMAIL` is optional and public.

## Deployment and persistent data

### Render API service

The repository includes a `render.yaml` Blueprint for the backend. It sets the service root to `server/`, installs from `server/package-lock.json` using `npm ci`, starts the API with `npm start`, and checks `/api/health`. If configuring an existing Render web service manually, set **Root Directory** to `server`, **Build Command** to `npm ci`, and **Start Command** to `npm start` (not `npm build` or `npm run build`; the API has no build step). Configure the Blueprint's `MONGO_URI`, `CLIENT_URL`, and SMTP values in Render's environment settings; never put secrets in the YAML file.

1. Provision MongoDB, SMTP, and HTTPS origins. Set production environment variables in the hosting provider's secret manager; do not deploy development secrets.
2. Build the client with `npm run build` in `client/` and host `client/dist` on a static host with SPA history fallback enabled.
3. Run `npm start` in `server/` on a persistent Node host. Configure `CLIENT_URL` with the deployed client origin and `VITE_API_URL` with the HTTPS API URL.
4. Persist and back up MongoDB and the server image directories. Verification uploads are saved in `server/uploads/`; approved packaging references are saved in `server/reference-images/`. Ephemeral container disks will lose these files on restart/redeploy unless attached storage or object storage is configured.
5. Confirm the API health endpoint, email delivery, CORS, upload limits, auth, and a full verification/history flow in the deployment environment before launch.

Uploaded verification images are currently served from `/uploads` as static files. Treat that directory and any resulting image URLs as potentially accessible to anyone who obtains the URL; do not store sensitive or identifying imagery unless this exposure is acceptable for your deployment. OCR text and extracted package fields are persisted with scan records. Define operational access controls, backups, and a retention/deletion policy appropriate for your jurisdiction.

Previously uploaded scan photos were deleted from this workspace at the owner's request. Existing database records may still refer to those old paths, so historical thumbnails for those records may be unavailable. Restore corresponding files from a backup if they are needed.

## API overview

Routes are mounted under `/api`:

- `GET /health` — health check.
- `/auth` — registration, email verification, login, current user.
- `/verification` — authenticated multipart verification, progress polling, and result retrieval. `POST /verification/preview` extracts fields for user review without saving a verification record; `POST /verification` accepts optional `confirmedFields` JSON alongside medicine photos and an optional separately tagged `qrImage`.
- `/scans` — authenticated scan history.
- `/dashboard` — authenticated user dashboard statistics.
- `/admin` — authenticated administration API.

The verification upload accepts `image` (legacy single image) or `images` (multiple medicine images), plus one optional `qrImage` multipart field. Supported MIME types are JPEG, PNG, and WEBP. The API enforces a 10 MB per-file limit and a maximum of five medicine images per request. The client first calls `POST /verification/preview` to show extracted values, then sends edited/confirmed values as JSON in the `confirmedFields` field when it submits the final `POST /verification` request.

## Known limitations and data gaps

- OCR uses heuristic parsing of printed English package text. Rotated-photo preprocessing helps, but fields can still be missed or misread. Field confidence is an estimate based on matching extracted tokens to Tesseract word confidence, not a calibrated probability.
- OCR field corrections are user-confirmed inputs, not independent evidence that the printed package actually contains the corrected value. Review the package photos when correcting OCR.
- The application does not currently provide a 1D barcode decoder.
- Users cannot currently submit an in-app suspicious-medicine report.
- A QR code is only checked against MediTrust's local data; there is no live manufacturer, government, CDSCO, or DrugSetu verification.
- Packaging similarity requires an approved reference image for the matched medicine. Some catalog medicines do not yet have reference images; for these, comparison is reported as unavailable rather than as a package mismatch.
- Deleted historical upload images cannot be served unless restored from backup. New uploads and approved reference images require durable storage.
- Administrators should review seeded medicines, batch codes, QR data, and reference images before relying on them in production.
