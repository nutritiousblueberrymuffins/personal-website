import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  // Multi-page site: every HTML file listed here becomes its own entry.
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        home: page('./index.html'),
        timeline: page('./timeline.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // timeline.js imports api/data/timeline.json from the repo root as a build-time fallback.
      allow: ['..'],
    },
  },
});
