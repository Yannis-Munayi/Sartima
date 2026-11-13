import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sartima',
        short_name: 'Sartima',
        description: 'Find your aesthetic, get outfits from your own closet, and see which pieces are worth buying next.',
        theme_color: '#F7F4EE',
        background_color: '#F7F4EE',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Not precached: the big data chunks (runtime-cached below instead, so the
        // SW install doesn't double the first launch's download), the background-
        // removal runtime (only loaded when someone uses "prettify"), and the
        // social-share image (only crawlers fetch it).
        globIgnores: [
          '**/data-products-*.js', '**/data-catalog-*.js', '**/data-content-*.js',
          '**/ort.*.js', 'og-image.png',
        ],
        // Real files the SW must not answer with the SPA shell: the Android APK
        // download and Digital Asset Links (Android app verification).
        navigateFallbackDenylist: [/^\/downloads\//, /^\/\.well-known\//],
        // Network-first for API calls; cache-first for static
        runtimeCaching: [
          {
            // Catalog data chunks: file names are content-hashed, so a cached copy
            // is never stale. Kept after the first launch, so later launches
            // don't wait on the network for 5+ MB of catalog.
            urlPattern: /\/assets\/data-[\w-]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'catalog-chunks',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Pexels images — cache for 7 days
            urlPattern: /^https:\/\/images\.pexels\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pexels-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Unsplash images — cache for 7 days
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firebase Firestore API — network first with cache fallback
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    watch: {
      // Not app source. The QA suite streams videos, traces and screenshots
      // into qa/results for the whole run, and agent worktrees under .claude
      // are full copies of the repo; watching them slowed page loads enough
      // that QA tests timed out in page.goto.
      ignored: ['**/qa/results/**', '**/.claude/**', '**/test-results/**', '**/playwright-report/**'],
    },
  },
  // Only scan the app's own entry page for dependencies to pre-bundle (by
  // default Vite crawls every .html in the repo, including qa/dashboard and
  // the worktree copies).
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const n = id.replace(/\\/g, '/')
          if (n.includes('/node_modules/react/') || n.includes('/node_modules/react-dom/')) return 'react-core'
          if (n.includes('/node_modules/firebase/')) return 'firebase'
          if (/\/src\/data\/(styles|categories|aestheticItems|looks|retailers|labels)\.js$/.test(n)) return 'data-styles'
          if (/\/src\/data\/(aestheticDepth|itemGuide)\.js$/.test(n)) return 'data-content'
          if (/\/src\/data\/products/.test(n)) return 'data-products'
          if (/\/src\/data\/(brands|aesthetics)\.js$/.test(n)) return 'data-catalog'
        },
      },
    },
  },
})
