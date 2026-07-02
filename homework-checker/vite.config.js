import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,       // disable source maps in production
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split big libraries into separate chunks for better caching
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react'
            }
            if (id.includes('chess.js') || id.includes('react-chessboard')) {
              return 'chess'
            }
            if (id.includes('recharts')) {
              return 'charts'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query'
            }
            if (id.includes('socket.io-client')) {
              return 'socket'
            }
          }
        },
      },
    },
  },
  // Exposes VITE_ env vars to the browser bundle
  envPrefix: 'VITE_',
})
