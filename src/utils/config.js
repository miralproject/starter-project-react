export const APP_CONFIG = {
  defaultFpsLimit: 12,
  minFpsLimit: 4,
  maxFpsLimit: 30,
  detectionConfidenceThreshold: 0.72,
  analysisDelayMs: 120,
};

export const TENSORFLOW_CONFIG = {
  modelPath: '/model/model.json',
  metadataPath: '/model/metadata.json',
  inputSize: [224, 224],
  normalizationFactor: 255,
};

export const TRANSFORMERS_CONFIG = {
  modelName: 'Xenova/LaMini-Flan-T5-77M',
  dtype: 'q4',
  maxNewTokens: 120,
  temperature: 0.45,
  topP: 0.9,
  doSample: true,
};

export const PERSONA_OPTIONS = [
  { value: 'normal', label: 'Netral' },
  { value: 'funny', label: 'Lucu' },
  { value: 'history', label: 'Sejarah' },
];

export const TONE_CONFIG = {
  availableTones: PERSONA_OPTIONS,
  defaultTone: PERSONA_OPTIONS[0].value,
};

export const isValidDetection = (result) =>
  !!result && typeof result.confidence === 'number' && result.confidence >= APP_CONFIG.detectionConfidenceThreshold;
