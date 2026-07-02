import { TRANSFORMERS_CONFIG, TONE_CONFIG } from '../utils/config.js';
import { isWebGPUSupported, logError } from '../utils/common.js';

const PERSONA_PROMPTS = {
  normal: 'Write in a friendly and informative tone.',
  funny: 'Write with a playful and slightly humorous tone.',
  history: 'Focus on history, origin, and cultural context.',
};

const FALLBACK_FACTS = {
  normal: (label) => `${label} is a nutritious vegetable that fits easily into many everyday meals.`,
  funny: (label) => `${label} can make a meal feel a little more exciting, even on a busy day.`,
  history: (label) => `${label} has a long relationship with human cooking and global food culture.`,
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.currentTone = TONE_CONFIG.defaultTone;
    this.backend = 'wasm';
  }

  async loadModel(onProgress) {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');

      env.allowLocalModels = false;
      env.useBrowserCache = true;

      this.backend = isWebGPUSupported() ? 'webgpu' : 'wasm';

      const progressHandler = (progress) => {
        if (typeof onProgress !== 'function') {
          return;
        }

        const percent = typeof progress?.progress === 'number'
          ? Math.max(1, Math.min(99, Math.round(progress.progress)))
          : 1;

        onProgress(percent, `Menunggu Model... ${percent}%`);
      };

      this.generator = await pipeline('text2text-generation', TRANSFORMERS_CONFIG.modelName, {
        dtype: TRANSFORMERS_CONFIG.dtype,
        device: this.backend,
        progress_callback: progressHandler,
      });

      this.isModelLoaded = true;

      if (typeof onProgress === 'function') {
        onProgress(100, 'Model Siap 100%');
      }

      return {
        backend: this.backend,
        modelName: TRANSFORMERS_CONFIG.modelName,
      };
    } catch (error) {
      logError('Gagal memuat model generatif', error);
      this.generator = null;
      this.isModelLoaded = false;
      throw new Error(`Gagal memuat model generatif: ${error.message}`);
    }
  }

  setTone(tone) {
    this.currentTone = tone || TONE_CONFIG.defaultTone;
  }

  buildPrompt(vegetableName) {
    const personaPrompt = PERSONA_PROMPTS[this.currentTone] || PERSONA_PROMPTS.normal;
    return [
      'You are a helpful food storyteller.',
      `Write a fun fact in Indonesian about ${vegetableName}.`,
      personaPrompt,
      'Keep it concise, vivid, accurate, and under 80 words.',
    ].join(' ');
  }

  fallbackFact(vegetableName) {
    const factory = FALLBACK_FACTS[this.currentTone] || FALLBACK_FACTS.normal;
    return factory(vegetableName);
  }

  async generateFacts(vegetableName) {
    const name = String(vegetableName || '').trim();

    if (!name) {
      throw new Error('Nama sayuran tidak valid.');
    }

    this.isGenerating = true;

    try {
      const prompt = this.buildPrompt(name);

      if (!this.generator) {
        return {
          funFact: this.fallbackFact(name),
          prompt,
          backend: this.backend,
          generated: false,
        };
      }

      const response = await this.generator(prompt, {
        max_new_tokens: TRANSFORMERS_CONFIG.maxNewTokens,
        temperature: TRANSFORMERS_CONFIG.temperature,
        top_p: TRANSFORMERS_CONFIG.topP,
        do_sample: TRANSFORMERS_CONFIG.doSample,
        return_full_text: false,
      });

      const text = Array.isArray(response)
        ? response[0]?.generated_text ?? ''
        : response?.generated_text ?? '';

      return {
        funFact: text.trim() || this.fallbackFact(name),
        prompt,
        backend: this.backend,
        generated: true,
      };
    } catch (error) {
      logError('Gagal menghasilkan fun fact', error);

      return {
        funFact: this.fallbackFact(name),
        prompt: this.buildPrompt(name),
        backend: this.backend,
        generated: false,
      };
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded && !!this.generator && !this.isGenerating;
  }
}
