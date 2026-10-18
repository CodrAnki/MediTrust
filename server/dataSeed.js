// The ONE command that prepares a MediTrust database:
//
//   cd server && npm run data:seed
//
// 1. connects to MongoDB (MONGO_URI)
// 2. creates/promotes the super admin from SUPER_ADMIN_* in server/.env
// 3. upserts reference Medicines, Batches and ManufacturerQr records (seed/referenceData.js)
// 4. creates the approved ReferenceImage records for the reference photos
//
// Idempotent (everything is an upsert keyed on a natural unique key, so re-running
// never duplicates anything) and non-destructive (nothing is deleted; records not
// listed in seed/referenceData.js are never touched). No demo accounts, no
// hardcoded credentials.

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Medicine from './models/Medicine.js';
import Batch from './models/Batch.js';
import ManufacturerQr from './models/ManufacturerQr.js';
import ReferenceImage from './models/ReferenceImage.js';
import { ensureSuperAdmin, validateSuperAdminConfig, SuperAdminConfigError } from './services/superAdminService.js';
import { migrateLegacyReferenceImages, referenceDir } from './services/referenceImageService.js';
import { MEDICINES, BATCHES, MANUFACTURER_QRS } from './seed/referenceData.js';

const ok = (msg) => console.log(`✓ ${msg}`);
const warn = (msg) => console.log(`⚠ ${msg}`);

async function seedMedicines() {
  const byName = new Map();
  for (const record of MEDICINES) {
    const doc = await Medicine.findOneAndUpdate(
      { medicineName: record.medicineName },
      { $set: record, $setOnInsert: { source: 'seed', active: true } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false },
    );
    byName.set(record.medicineName, doc);
  }
  return byName;
}

async function seedBatches(medicines) {
  let count = 0;
  for (const { medicineName, ...fields } of BATCHES) {
    const medicine = medicines.get(medicineName);
    if (!medicine) { warn(`Skipped batch ${fields.batchNumber}: medicine "${medicineName}" missing.`); continue; }
    // setDefaultsOnInsert:false on purpose: Batch.qrCode/barcode default to null, and a
    // stored null would collide on their unique-sparse indexes across batches. Absent is correct.
    await Batch.findOneAndUpdate(
      { batchNumber: fields.batchNumber },
      { $set: { ...fields, medicineId: medicine._id, manufacturer: medicine.manufacturer } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: false },
    );
    count += 1;
  }
  // Older seeds stored fake "DEMO-NO-QR-*" placeholders; clear ONLY those, never a real qrCode.
  await Batch.updateMany(
    { batchNumber: { $in: BATCHES.map((b) => b.batchNumber) }, qrCode: { $regex: '^DEMO-NO-QR-' } },
    { $unset: { qrCode: '' } },
  );
  return count;
}

async function seedManufacturerQrs() {
  for (const record of MANUFACTURER_QRS) {
    await ManufacturerQr.findOneAndUpdate({ payload: record.payload }, { $set: record }, { upsert: true, returnDocument: 'after' });
  }
  return MANUFACTURER_QRS.length;
}

async function main() {
  console.log('MediTrust Data Seed');
  console.log('-------------------');

  // Fail before touching the database if the admin config is unusable.
  try { validateSuperAdminConfig(); } catch (err) {
    if (err instanceof SuperAdminConfigError) {
      console.error(`✗ Super admin configuration problem: ${err.message}\n  Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in server/.env (see .env.example).`);
      process.exit(1);
    }
    throw err;
  }

  await connectDB();
  await Promise.all([User, Medicine, Batch, ManufacturerQr, ReferenceImage].map((m) => m.init())); // make sure unique indexes exist
  ok('MongoDB connected');

  const admin = await ensureSuperAdmin();
  ok(`Super admin configured (${admin.action}): ${admin.email}`);

  const medicines = await seedMedicines();
  ok(`Medicines seeded: ${medicines.size}`);

  const batches = await seedBatches(medicines);
  ok(`Batches seeded: ${batches}`);

  const qrs = await seedManufacturerQrs();
  ok(`Manufacturer QR records seeded: ${qrs}`);

  const missingFiles = MEDICINES.filter((m) => m.image && !fs.existsSync(path.join(referenceDir, m.image))).map((m) => m.image);
  const created = await migrateLegacyReferenceImages();
  const approved = await ReferenceImage.countDocuments({ medicineId: { $in: [...medicines.values()].map((m) => m._id) }, verificationStatus: 'approved', enabled: true });
  ok(`Reference images ready: ${approved} approved (${created} newly registered)`);
  if (missingFiles.length) warn(`Reference image file(s) not found in server/reference-images: ${missingFiles.join(', ')}`);

  // Safety notices (read-only: nothing is modified or deleted here).
  const legacyDemo = await User.countDocuments({ email: { $regex: '@meditrust\\.demo$', $options: 'i' } });
  if (legacyDemo) warn(`${legacyDemo} legacy demo account(s) (@meditrust.demo) exist in this database. Deactivate them in Admin → Users.`);
  if (await Medicine.exists({ medicineName: 'Zovivast-AQ' })) warn('Legacy medicine "Zovivast-AQ" exists but has no reference data (not in medicine.pdf); left untouched.');

  ok('Reference data ready');
  console.log('\nData seed completed successfully.');
  if (env.isProduction) console.log('(production mode)');
}

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(`\n✗ Data seed failed: ${err.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
