import { SUPPORTED_FORMATS, MAX_FILE_SIZE } from './constants.js';

export function validateModelFile(file) {
  const errors = [];
  const extension = file.name.split('.').pop().toLowerCase();
  if (!SUPPORTED_FORMATS.includes(extension)) {
    errors.push(`Unsupported format: .${extension}. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
  }
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  if (file.size === 0) {
    errors.push('File is empty');
  }
  return { valid: errors.length === 0, errors };
}

export function validateUrl(url) {
  try {
    new URL(url);
    return { valid: true, errors: [] };
  } catch {
    return { valid: false, errors: ['Invalid URL format'] };
  }
}

export function validateSettings(settings) {
  const errors = [];
  if (settings.fov && (settings.fov < 1 || settings.fov > 179)) {
    errors.push('FOV must be between 1 and 179');
  }
  if (settings.minDistance && settings.minDistance < 0) {
    errors.push('Min distance must be non-negative');
  }
  return { valid: errors.length === 0, errors };
}
