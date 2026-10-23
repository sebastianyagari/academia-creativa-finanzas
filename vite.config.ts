import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

export default defineConfig({
  plugins: [
    react(),
    // App instalable y sin internet (SPEC 10). El service worker guarda la app
    // completa (incluido Excel) en el dispositivo; los datos siguen en IndexedDB.
    VitePWA({
      // La persona decide cuándo actualizar: "Hay una versión nueva. Toca para actualizar."
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['robots.txt', 'brand/*.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Academia Creativa Finanzas',
        short_name: 'Finanzas',
        description: 'Organiza tus finanzas personales. Tus datos se quedan en tu dispositivo.',
        lang: 'es-CO',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F2F9',
        theme_color: '#6A1B9A',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        // ExcelJS (~1 MB) también queda guardado para exportar sin internet.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    // El engine es TypeScript puro: corre en Node. Las pruebas de componentes
    // piden jsdom con el comentario `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/tests/setup.ts'],
    env: { TZ: 'America/Bogota' },
  },
});
