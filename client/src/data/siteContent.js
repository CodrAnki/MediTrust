import {
  UploadCloud, ScanText, PackageSearch, Images, ScanSearch, QrCode, Layers, ShieldAlert, Gauge, ShieldCheck,
  FileSearch, Database, Lock, Eye,
} from 'lucide-react';

// ONE source of truth for every public description of the MediTrust
// architecture, so the home page, How It Works, About, FAQ, verify page and
// result page can never contradict each other.

export const pipelineSteps = [
  { n: '01', icon: UploadCloud, title: 'Upload medicine', short: 'Strip, bottle, box, label or packaging photo.',
    points: ['Strip or blister', 'Bottle or box', 'Label', 'Any packaging image'],
    description: 'You upload one or more clear photos of the medicine packaging.' },
  { n: '02', icon: ScanText, title: 'OCR & image processing', short: 'Reads the printed text from the image.',
    points: ['Medicine name, brand, composition', 'Strength and dosage form', 'Manufacturer', 'Batch, dates and MRP where printed'],
    description: 'The image is prepared and optical character recognition extracts the printed information.' },
  { n: '03', icon: PackageSearch, title: 'Medicine identification', short: 'Matches against the MediTrust medicine database.',
    points: ['Search trusted local medicine records', 'Compare name, manufacturer, composition and strength', 'Candidate medicine with match confidence', 'Clear match reasons'],
    description: 'The extracted details are matched to a known medicine, local records first.' },
  { n: '04', icon: Images, title: 'Reference packaging', short: 'Loads admin-approved reference images.',
    points: ['Front, back and side views', 'Strip, bottle and label views', 'Only approved references are used'],
    description: 'Approved MediTrust reference images for the identified medicine are loaded.' },
  { n: '05', icon: ScanSearch, title: 'Packaging similarity', short: 'Compares your photo with approved references.',
    points: ['Visual comparison against each approved reference', 'Packaging similarity score', 'Reported as unavailable when no reference exists'],
    description: 'The uploaded packaging is compared with the approved references.' },
  { n: '06', icon: QrCode, title: 'QR / barcode', short: 'Decodes and checks printed codes when present.',
    points: ['Detect and decode the code', 'Compare with registered records', 'Detect mismatches', 'Missing code is not negative evidence'],
    description: 'If a QR code is printed on the pack it is decoded and validated.' },
  { n: '07', icon: Layers, title: 'Batch verification', short: 'Checks the batch against registered batches.',
    points: ['Batch number and medicine', 'Manufacturer', 'Manufacturing and expiry date', 'Registered status'],
    description: 'The batch details are compared with the batches registered in MediTrust.' },
  { n: '08', icon: ShieldAlert, title: 'Duplicate detection', short: 'Looks for suspicious repeated identifiers.',
    points: ['Repeated QR codes', 'Repeated batch or identifiers', 'Unusual repeat-scan patterns'],
    description: 'Repeated use of the same identifiers is flagged as a signal, never as proof.' },
  { n: '09', icon: Gauge, title: 'Risk engine', short: 'Combines every available signal.',
    points: ['OCR consistency and medicine match', 'Composition, manufacturer, strength', 'Packaging, QR and batch results', 'Duplicate result and reference availability'],
    description: 'The MediTrust risk engine weighs all available signals into one score.' },
  { n: '10', icon: ShieldCheck, title: 'Final result', short: 'Status, risk level and the evidence behind it.',
    points: ['Verification status', 'Risk level and score', 'Every signal that contributed'],
    description: 'You see the result together with the evidence — never a bare green or red answer.' },
];

export const technologyLayers = [
  { icon: ScanText, title: 'OCR', text: 'Extracts the printed medicine details from packaging.' },
  { icon: PackageSearch, title: 'Medicine identification', text: 'Matches medicine details against the MediTrust reference database.' },
  { icon: Images, title: 'Reference packaging', text: 'Compares packaging with approved reference images.' },
  { icon: QrCode, title: 'QR / barcode', text: 'Checks available product identifiers.' },
  { icon: Layers, title: 'Batch verification', text: 'Validates registered batch information.' },
  { icon: ShieldAlert, title: 'Duplicate detection', text: 'Flags suspicious repeated identifiers.' },
  { icon: Gauge, title: 'Risk engine', text: 'Combines the available signals into a risk assessment.' },
];

export const whyCards = [
  { icon: ScanText, title: 'OCR Analysis', text: 'Extract medicine information from packaging.' },
  { icon: PackageSearch, title: 'Medicine Identification', text: 'Identify medicines using the MediTrust reference database.' },
  { icon: Images, title: 'Reference Packaging', text: 'Compare packaging with approved reference images.' },
  { icon: QrCode, title: 'QR & Barcode', text: 'Analyze available product identifiers.' },
  { icon: Layers, title: 'Batch Verification', text: 'Validate registered batch information.' },
  { icon: ShieldAlert, title: 'Duplicate Detection', text: 'Identify suspicious repeated identifiers.' },
  { icon: Gauge, title: 'Risk Engine', text: 'Combine multiple verification signals.' },
  { icon: FileSearch, title: 'Transparent Results', text: 'Explain the available evidence instead of showing only a green/red answer.' },
];

export const privacyPoints = [
  { icon: Lock, title: 'Protected accounts', text: 'Passwords are hashed and access to verification history requires sign-in.' },
  { icon: Eye, title: 'Private image processing', text: 'Uploaded photos are processed by MediTrust and are not sent to an external medicine lookup service.' },
  { icon: Database, title: 'Admin-controlled reference data', text: 'Reference medicines, images and batches are curated by MediTrust administrators and every change is audit-logged.' },
];

export const faqs = [
  { q: 'How does MediTrust verify a medicine?', a: 'MediTrust analyzes available medicine information using OCR, database matching, reference packaging comparison, QR/barcode verification, batch validation, duplicate detection, and risk analysis.' },
  { q: 'What if no reference image exists?', a: 'MediTrust reports that reference data is unavailable rather than automatically declaring the medicine fake.' },
  { q: 'Can MediTrust guarantee authenticity?', a: 'No. MediTrust provides a multi-signal verification assessment based on available evidence. It does not replace professional or regulatory verification.' },
  { q: 'What if the QR code is missing?', a: 'The system continues with the other available verification signals. A missing QR code is not treated as negative evidence.' },
  { q: 'What happens if the medicine is not in the database?', a: 'You get a "reference not found" or "unknown" result explaining that there is not enough evidence. An unknown medicine is never automatically labelled fake.' },
];

// Responsible, evidence-based wording for every possible result.
export const statusMessages = {
  VERIFIED_AGAINST_REFERENCE: 'The details read from your photos agree with MediTrust’s reference records. This is not a guarantee that the medicine is genuine.',
  NEEDS_REVIEW: 'Some details could not be confirmed or need a human look. This does not mean the medicine is fake.',
  MISMATCH_DETECTED: 'Something printed on the package disagrees with MediTrust’s reference records. The exact differences are listed below.',
  INVALID_INPUT: 'The uploaded file could not be used. Please upload a clear photo of the package.',
  PROCESSING_FAILED: 'The verification could not be completed. Nothing has been concluded about this medicine.',
  VERIFIED: 'Available verification signals are consistent with the registered reference data.',
  HIGH_CONFIDENCE: 'Older result: some required details (such as batch or expiry) may not have been checked. Treat as needing review.',
  SUSPICIOUS: 'Some verification signals are inconsistent or require further review.',
  HIGH_RISK: 'Multiple verification signals indicate elevated risk.',
  MISMATCH: 'One or more available verification signals do not match the registered data.',
  UNKNOWN: 'There is insufficient evidence to determine a reliable verification status.',
  REFERENCE_NOT_FOUND: 'No approved reference packaging data was found for comparison.',
  NOT_DETECTED: 'Required information could not be detected from the uploaded image.',
  NOT_AVAILABLE: 'The required verification data is currently unavailable.',
  EXPIRED: 'The expiry date read from the package has passed.',
};
