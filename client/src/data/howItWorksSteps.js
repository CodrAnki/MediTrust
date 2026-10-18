import { pipelineSteps, statusMessages } from './siteContent.js';

// The /how-it-works page uses the same pipeline definition as the home page.
export const howItWorksSteps = pipelineSteps;

export const resultOutcomes = [
  { key: 'verified', label: 'VERIFIED AGAINST REFERENCE', color: 'verified', description: statusMessages.VERIFIED_AGAINST_REFERENCE },
  { key: 'needs_review', label: 'NEEDS REVIEW', color: 'warning', description: statusMessages.NEEDS_REVIEW },
  { key: 'mismatch', label: 'MISMATCH DETECTED', color: 'danger', description: statusMessages.MISMATCH_DETECTED },
  { key: 'expired', label: 'EXPIRED', color: 'danger', description: statusMessages.EXPIRED },
  { key: 'reference', label: 'REFERENCE NOT FOUND', color: 'warning', description: statusMessages.REFERENCE_NOT_FOUND },
  { key: 'not_detected', label: 'NOT DETECTED', color: 'warning', description: statusMessages.NOT_DETECTED },
  { key: 'not_available', label: 'NOT AVAILABLE', color: 'warning', description: statusMessages.NOT_AVAILABLE },
];
