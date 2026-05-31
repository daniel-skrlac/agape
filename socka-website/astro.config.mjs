import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    clearScreen: false,
    server: {
      watch: {
        // Linux fix for: EMFILE: too many open files, watch ...
        // Uses polling and ignores heavy/generated folders.
        usePolling: true,
        interval: 700,
        binaryInterval: 1200,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.astro/**',
          '**/dist/**',
          '**/.vscode/**',
          '**/.idea/**'
        ]
      }
    }
  }
});
