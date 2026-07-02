import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Generate the service worker automatically from the actual build output,
      // instead of a hand-written precache list that goes stale every build
      // (hashed JS/CSS bundle names change every build, so a manual list
      // could never keep up -> that's why the app shell failed offline).
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: false, // sw.js is registered manually in src/main.jsx
      filename: 'sw.js',
      manifest: false, // we already ship our own /manifest.webmanifest
      includeAssets: [
        'favicon.ico',
        'icons/*.png',
        'screenshots/*',
        'model/*',
      ],
      workbox: {
        // Precache the full app shell: hashed JS/CSS, html, icons, manifest,
        // and the local TFJS vegetable-classifier model files.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json,bin}'],
        // Allow the ~2MB TFJS weights.bin to be precached (default limit is 2MB).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // SPA fallback so a reload/offline navigation still renders the app shell.
        navigateFallback: '/index.html',
        runtimeCaching: [
          // Google Fonts stylesheet
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          // Google Fonts font files
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // onnxruntime-web WASM runtime (ort-wasm-simd-threaded.jsep.mjs / .wasm),
          // served from cdn.jsdelivr.net. Checked before the broader HF/jsDelivr
          // rule below so these land in their own dedicated cache bucket.
          {
            urlPattern: ({ url }) =>
              url.pathname.endsWith('.wasm') || url.pathname.includes('ort-wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'onnxruntime-wasm-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // @huggingface/transformers downloads the LaMini-Flan-T5 tokenizer,
          // config, and quantized ONNX encoder/decoder weights from the HF hub
          // (proxied through jsDelivr). None of this was in the old sw.js list.
          {
            urlPattern: ({ url }) =>
              url.hostname === 'huggingface.co' ||
              url.hostname.endsWith('.huggingface.co') ||
              url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-model-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3001,
    host: true,
  },
});
