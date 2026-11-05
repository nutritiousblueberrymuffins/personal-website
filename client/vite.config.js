import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

// GitHub Pages serves a project site under /<repo>/. The deploy workflow passes that prefix in
// BASE_PATH (empty for a user site or a custom domain); local dev and plain builds use '/'.
const base = `${process.env.BASE_PATH ?? ''}/`.replace(/\/+$/, '/');

export default defineConfig({
  base,
  // Multi-page site: every HTML file listed here becomes its own entry.
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        home: page('./index.html'),
        timeline: page('./timeline/index.html'),
        notFound: page('./404.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
