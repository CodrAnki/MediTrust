// Canonical reference data for MediTrust verification. Merged from the former
// seedReferenceData.js / seedDemoBatch.js / seedRemainingBatches.js /
// seedManufacturerQr.js. Pure data: dataSeed.js is the only thing that writes it.
//
// PROVENANCE: every value comes from real photos of real packaging (medicine.pdf
// and the project's own photos), never invented. Notes on confidence are kept next
// to the value they qualify.
//
// DELIBERATELY NOT SEEDED:
//  - the old seed.js sample medicines "Paracetamol 500 MG" (PCM100001 / QR100001) and
//    "Amoxicillin 250 MG" (AMX100002 / QR100002): their batch numbers and QR payloads
//    were invented placeholders, not read from any packaging, so seeding them would
//    create fake "verified" matches.
//  - "Zovivast-AQ": it is not a product in medicine.pdf (see PHASE11_REFERENCE_DATA_REPORT.md).
//    A pre-existing record with that name, if any, is neither modified nor deleted.
//
// Manufacturer convention: `manufacturer` holds the string OCR most reliably reads off
// the box AND that doesn't collide with sibling products; contract-manufacturer text
// is preserved in `description`. `strength` is only set for the single-ingredient
// product (a wrong strength would turn a genuine pack into a false MISMATCH).

export const MEDICINES = [
  {
    medicineName: 'Zoxvitaz-L',
    manufacturer: 'Zoxvina Biotech Pvt. Ltd.',
    description: 'Mfd. by: Ultra Drugs Pvt. Ltd. (Unit-II)',
    genericName: 'Lycopene, Lutein, Betacarotene, Black Grape Seed Extract, Selenium Dioxide Monohydrate & Zinc Sulphate Monohydrate Softgel Capsules',
    image: 'zoxvitaz-l-DEMO-reference.jpg',
  },
  {
    medicineName: 'Palzit-DSR',
    manufacturer: 'Zoxvina Biotech Pvt. Ltd.',
    genericName: 'Pantoprazole (Gastro-Resistant) & Domperidone (Prolonged-Release) Capsules I.P. -- Pantoprazole Sodium Sesquihydrate eq. to Pantoprazole 40mg, Domperidone 30mg',
    image: 'palzit-dsr-reference.jpg',
  },
  {
    medicineName: 'ZOXFER-XT PLUS',
    brandName: 'ZOXFER-XT PLUS',
    manufacturer: 'Zoxvina Biotech Pvt. Ltd.',
    description: 'Manufactured for: Zoxvina Biotech Pvt. Ltd. Mfd. by: J.M. Laboratories, Village-Bhanat, P.O.-Ghatti, Subathu Road, Solan (H.P.) 173211. MRP ₹215.00 per 15 tablets, inclusive of all taxes.',
    genericName: 'Ferrous Bisglycinate 60mg, Zinc Bisglycinate 15mg, Folic Acid 1mg & Methylcobalamin 500mcg Tablets',
    composition: 'Ferrous Bisglycinate I.P. 60 mg, Zinc Bisglycinate I.P. 15 mg, Folic Acid I.P. 1 mg, Methylcobalamin I.P. 500 mcg',
    strength: '60 mg + 15 mg + 1 mg + 500 mcg',
    dosageForm: 'Tablets',
    mrp: 215,
    packSize: '10 x 15 Tablets',
    image: 'ref-1792121366539-4e73795dab5a.jpeg',
  },
  {
    medicineName: 'Zovifast-AQ',
    manufacturer: 'Zoxvina Biotech Pvt. Ltd.',
    description: 'Mfd. by: Ultra Drugs Pvt. Ltd., Plot No. 1315-1318, VPO Manpura, Baddi-Nalagarh Road, Distt. Solan (H.P.) 174101',
    genericName: 'Diclofenac Sodium Injection IP -- analgesic & anti-inflammatory, aqueous base injection',
    strength: '75mg',
    image: 'zovifast-aq-reference.jpg',
  },
  {
    medicineName: 'Safezyme Syrup',
    manufacturer: 'Best Biotech',
    description: 'Mfg. by: Sun Biotec',
    genericName: 'Digestive Enzyme Syrup (Sugar Free) -- Fungal Diastase (1:1200) 50mg & Papain 10mg per 15ml',
    image: 'safezyme-syrup-reference.jpg',
  },
];

// Batch.qrCode is intentionally absent on every record: none of these boxes carries a
// genuine per-batch QR (only the shared manufacturer QR below), so no placeholder.
export const BATCHES = [
  { medicineName: 'Zoxvitaz-L', batchNumber: 'US-25361A', manufacturingDate: '12/2025', expiryDate: '11/2027', serialPrefix: 'US', status: 'ACTIVE' },
  // Same stamp read on three independent photos in medicine.pdf: high confidence.
  { medicineName: 'Palzit-DSR', batchNumber: '25LC019F', manufacturingDate: '12/2025', expiryDate: '11/2027', status: 'ACTIVE' },
  // CONFIDENCE: fine dot-matrix print seen on ONE photo only. Confirm against a physical unit.
  { medicineName: 'ZOXFER-XT PLUS', batchNumber: 'GT28624F', manufacturingDate: '10/2025', expiryDate: '03/2027', mrp: 215, status: 'ACTIVE' },
  { medicineName: 'Zovifast-AQ', batchNumber: 'UGA-2693B', manufacturingDate: '03/2026', expiryDate: '02/2028', status: 'ACTIVE' },
  { medicineName: 'Safezyme Syrup', batchNumber: 'SZ-2618', manufacturingDate: '02/2026', expiryDate: '07/2027', status: 'ACTIVE' },
];

// Only payloads actually decoded from real packaging pixels. Re-verified while fixing
// QR detection: jsQR (and independently ZBar) decode exactly this string from the
// project's ZOXFER-XT PLUS box photo. Safezyme Syrup shows no QR in the supplied photos.
export const MANUFACTURER_QRS = [
  {
    manufacturer: 'Zoxvina Biotech Pvt. Ltd.',
    payload: 'https://zoxvinabiotech.com/',
    note: 'Static marketing/portal QR printed identically on Zoxvina Biotech packaging (Zoxvitaz-L, Palzit-DSR, ZOXFER-XT PLUS, Zovifast-AQ): a shared manufacturer-level code, not a per-batch payload.',
    active: true,
  },
];
