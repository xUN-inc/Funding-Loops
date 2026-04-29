import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// ui-kit ships JSX inside `.js` files. Tell esbuild to parse `.js` as JSX,
// and tell @vitejs/plugin-react to apply Fast Refresh to them too.
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      include: /\.(jsx?|tsx?)$/,
    }),
  ],
  esbuild: {
    loader: 'jsx',
    include: /.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/METHODOLOGY.md': 'http://localhost:3000',
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: false,
  },
});
