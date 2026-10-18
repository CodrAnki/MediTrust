export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Returns null when the file is valid, or a human-readable error message.
export function validateMedicineImage(file) {
  if (!file) return 'No file selected.';

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Invalid image format. Please upload a JPG, PNG or WEBP file.';
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Image is larger than 10MB. Please upload a smaller file.';
  }

  return null;
}
