import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Duolingo du Pilotage',
        short_name: 'PilotageApp',
        description: 'Apprenez le pilotage sur circuit comme un pro',
        theme_color: '#1a202c',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          ui: ['@radix-ui/react', 'framer-motion'],
          utils: ['date-fns', 'zod', 'i18next']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 3001,
    host: true
  }
})
