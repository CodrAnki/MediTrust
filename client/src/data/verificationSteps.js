// Stage ids match server/services/progressService.js STAGES. Statuses shown on
// /verify/processing come from the backend (polled), not from a timer.
export const verificationSteps = [
  { id: 'image_received', label: 'Image received', description: 'Your image was received by the server.' },
  { id: 'ocr', label: 'Image preprocessing & extracting medicine information', description: 'Preparing the image and reading name, manufacturer, batch and dates.' },
  { id: 'identification', label: 'Identifying medicine', description: 'Matching extracted details against the MediTrust database.' },
  { id: 'batch', label: 'Verifying batch', description: 'Comparing the batch with registered batches.' },
  { id: 'qr', label: 'Checking QR/barcode', description: 'Validating any decoded QR code.' },
  { id: 'reference', label: 'Checking reference packaging', description: 'Comparing against approved reference images.' },
  { id: 'duplicate', label: 'Checking duplicate signals', description: 'Looking for suspicious repeated identifiers.' },
  { id: 'risk', label: 'Running risk analysis', description: 'Combining the available signals in the risk engine.' },
  { id: 'result', label: 'Preparing result', description: 'Saving and preparing your evidence report.' },
];
