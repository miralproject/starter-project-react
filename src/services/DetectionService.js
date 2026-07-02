import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import '@tensorflow/tfjs-backend-webgl';
import { APP_CONFIG, TENSORFLOW_CONFIG } from '../utils/config.js';
import { formatVegetableLabel, isWebGPUSupported, logError, validateModelMetadata } from '../utils/common.js';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = TENSORFLOW_CONFIG;
    this.backend = 'webgl';
  }

  async loadModel(onProgress, preferredBackend = null) {
    const desiredBackend = preferredBackend || (isWebGPUSupported() ? 'webgpu' : 'webgl');
    const updateProgress = (progress, message) => {
      if (typeof onProgress === 'function') {
        onProgress(progress, message);
      }
    };

    try {
      updateProgress(8, 'Menunggu Model... 8%');
      await tf.setBackend(desiredBackend);
      await tf.ready();
      this.backend = tf.getBackend();

      updateProgress(20, 'Menunggu Model... 20%');

      const [metadata, loadedModel] = await Promise.all([
        fetch(this.config.metadataPath).then((response) => response.json()),
        tf.loadLayersModel(this.config.modelPath, {
          onProgress: (fraction) => {
            const progress = 20 + Math.round(fraction * 70);
            updateProgress(progress, `Menunggu Model... ${progress}%`);
          },
        }),
      ]);

      if (!validateModelMetadata(metadata)) {
        throw new Error('Metadata model tidak valid.');
      }

      this.labels = metadata.labels;
      this.model = loadedModel;

      updateProgress(100, 'Model Siap 100%');

      return {
        backend: this.backend,
        labels: this.labels,
        modelName: metadata.modelName || 'Vegetable Classifier',
      };
    } catch (error) {
      logError('Gagal memuat model deteksi', error);

      if (desiredBackend === 'webgpu') {
        try {
          return await this.loadModel(onProgress, 'webgl');
        } catch (fallbackError) {
          logError('Fallback backend WebGL gagal', fallbackError);
        }
      }

      throw new Error(`Gagal memuat model deteksi: ${error.message}`);
    }
  }

  async predict(imageElement) {
    if (!this.model || this.labels.length === 0) {
      throw new Error('Model deteksi belum siap.');
    }

    if (!imageElement) {
      throw new Error('Sumber gambar untuk prediksi tidak ditemukan.');
    }

    const scores = tf.tidy(() => {
      const input = tf.browser
        .fromPixels(imageElement)
        .resizeBilinear(this.config.inputSize)
        .toFloat()
        .div(this.config.normalizationFactor)
        .expandDims(0);

      const prediction = this.model.predict(input);
      const tensor = Array.isArray(prediction) ? prediction[0] : prediction;
      return tensor.dataSync();
    });

    const values = Array.from(scores);
    const bestIndex = values.indexOf(Math.max(...values));
    const score = values[bestIndex] ?? 0;
    const rawLabel = this.labels[bestIndex] || 'unknown';
    const className = formatVegetableLabel(rawLabel);
    const confidence = Math.round(score * 100);

    return {
      className,
      rawLabel,
      confidence,
      score,
      backend: this.backend,
      isValid: score >= APP_CONFIG.detectionConfidenceThreshold,
    };
  }

  isLoaded() {
    return !!this.model && this.labels.length > 0;
  }
}
