import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import path from 'path';
import {defineConfig} from 'vite';

function buildInfo() {
  try {
    const commit = execSync('git rev-parse --short HEAD', { timeout: 8000 }).toString().trim() || 'dev';
    return { commit, time: new Date().toISOString() };
  } catch {
    return { commit: 'dev', time: new Date().toISOString() };
  }
}

export default defineConfig(() => {
  const build = buildInfo();
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __PARI_BUILD_COMMIT__: JSON.stringify(build.commit),
      __PARI_BUILD_TIME__: JSON.stringify(build.time),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
