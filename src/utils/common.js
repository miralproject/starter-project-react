import { APP_CONFIG } from './config.js';

export const logError = (context, error) => {
  console.error(`❌ ${context}:`, error);
};

export const isWebGPUSupported = () =>
  typeof navigator !== 'undefined' && 'gpu' in navigator;

export const isMobileDevice = () =>
  navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const createDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const validateModelMetadata = (metadata) =>
  !!metadata && Array.isArray(metadata.labels) && metadata.labels.length > 0;

export const formatVegetableLabel = (label) => {
  if (!label) return 'Unknown';

  return String(label)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getCameraConfig = () => ({
  defaultFPS: APP_CONFIG.defaultFpsLimit,
  fpsRange: {
    min: APP_CONFIG.minFpsLimit,
    max: APP_CONFIG.maxFpsLimit,
  },
  resolution: isMobileDevice()
    ? { width: 640, height: 960 }
    : { width: 960, height: 640 },
  facingMode: isMobileDevice() ? 'environment' : 'user',
});

export const getCameraConstraints = (facingMode) => {
  const config = getCameraConfig();

  return {
    audio: false,
    video: {
      facingMode: facingMode || config.facingMode,
      width: { ideal: config.resolution.width },
      height: { ideal: config.resolution.height },
      frameRate: { ideal: config.defaultFPS },
    },
  };
};

export const getCameraErrorMessage = (error) => {
  const errorMessages = {
    NotAllowedError: 'Izin kamera ditolak. Harap izinkan akses kamera.',
    NotFoundError: 'Tidak ada kamera ditemukan pada perangkat ini.',
    NotReadableError: 'Kamera sedang digunakan oleh aplikasi lain.',
    OverconstrainedError: 'Kamera tidak dapat memenuhi konfigurasi yang diminta.',
  };

  return errorMessages[error?.name] || 'Gagal memulai kamera';
};
