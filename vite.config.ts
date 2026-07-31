import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png'],
        manifest: {
          name: 'AlignerTrack',
          short_name: 'AlignerTrack',
          description: 'Orthodontic aligner wear-time logger, tray schedule, and maintenance tracker.',
          start_url: '/',
          display: 'standalone',
          background_color: '#020617',
          theme_color: '#020617',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Cache only the built app shell (JS/CSS/HTML/icons) for fast/offline
          // loading. Firestore/Auth/Storage calls are intentionally NOT cached
          // here — this app already has its own local-storage-first data layer,
          // and caching live API responses via the service worker would risk
          // serving stale synced data on top of that.
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        },
      }),
    ],
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
