import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png','icons/icon-512.png','logo.png'],
      manifest: {
        name:             'Ei! Finanças',
        short_name:       'Ei!',
        description:      'Suas finanças inteligentes com o Leon',
        theme_color:      '#7c3aed',
        background_color: '#0f1117',
        display:          'standalone',
        orientation:      'portrait',
        scope:            '/',
        start_url:        '/',
        lang:             'pt-BR',
        icons: [
          { src:'/icons/icon-192.png', sizes:'192x192', type:'image/png', purpose:'any maskable' },
          { src:'/icons/icon-512.png', sizes:'512x512', type:'image/png', purpose:'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [{
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: { cacheName:'google-fonts-cache', expiration:{ maxEntries:10, maxAgeSeconds:31536000 } },
        }],
      },
    }),
  ],
  server: { port: 5173 },
});
