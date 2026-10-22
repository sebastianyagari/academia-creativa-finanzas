import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // El engine es TypeScript puro: corre en Node. Las pruebas de componentes
    // piden jsdom con el comentario `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/tests/setup.ts'],
    env: { TZ: 'America/Bogota' },
  },
});
