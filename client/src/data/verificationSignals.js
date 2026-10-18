import { ScanText, QrCode, Layers, ScanSearch, ShieldAlert, PackageSearch } from 'lucide-react';

// The verification layers MediTrust combines (used on the verify page sidebar).
export const verificationSignals = [
  { key: 'ocr', icon: ScanText, title: 'OCR Extraction', description: 'Reads medicine name, manufacturer, batch number and dates off the package.' },
  { key: 'identification', icon: PackageSearch, title: 'Medicine Identification', description: 'Matches extracted details against the MediTrust medicine database.' },
  { key: 'packaging', icon: ScanSearch, title: 'Reference Packaging', description: 'Compares packaging with approved reference images.' },
  { key: 'qr', icon: QrCode, title: 'QR / Barcode Check', description: 'Checks the printed code against registered records when one is present.' },
  { key: 'batch', icon: Layers, title: 'Batch Verification', description: 'Confirms the batch, manufacturing date and expiry are on record.' },
  { key: 'duplicate', icon: ShieldAlert, title: 'Duplicate Detection', description: 'Flags suspicious repeated identifiers — never as proof on its own.' },
];

// Default risk bands. The thresholds are configurable by administrators.
export const riskLevels = [
  { key: 'low', label: 'Low Risk', range: '80–100', color: 'verified', description: 'Available signals are consistent with registered data.' },
  { key: 'medium', label: 'Medium Risk', range: '50–79', color: 'warning', description: 'Some signals could not be confirmed. Review before use.' },
  { key: 'high', label: 'High Risk', range: '0–49', color: 'danger', description: 'Multiple signals failed. Consult a pharmacist or relevant authority.' },
];
