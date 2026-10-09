import path from 'path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = process.env.PORT ? Number(process.env.PORT) : 5173;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const basePath = process.env.BASE_PATH || '/';

function buildServiceWorker() {
  return {
    name: 'build-service-worker',
    generateBundle(_: unknown, bundle: Record<string, { fileName: string; type: string }>) {
      const precacheUrls = Object.values(bundle)
        .filter((output) => output.type === 'chunk' || output.fileName.endsWith('.css'))
        .map((output) => output.fileName)
        .sort();
      const buildId = createHash('sha256')
        .update(precacheUrls.join('\n'))
        .digest('hex')
        .slice(0, 12);
      const source = readFileSync(path.resolve(import.meta.dirname, 'public', 'sw.js'), 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace('__PRECACHE_MANIFEST__', JSON.stringify(precacheUrls));

      bundle['sw.js'] = { type: 'asset', fileName: 'sw.js', source };
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    buildServiceWorker(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
