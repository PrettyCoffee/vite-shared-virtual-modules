import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { sharedModules } from './vite-shared-modules';

export default defineConfig({
  build: { manifest: 'manifest.json' },
  server: { port: 5173 },
  preview: { port: 5173 },
  plugins: [
    react(),
    sharedModules({
      role: 'provider',
      modules: {
        react: 'React',
        'react-dom/client': 'ReactDOM',
      },
    }),
  ],
});
