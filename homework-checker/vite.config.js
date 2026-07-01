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
        manualChunks: {
          react:    ['react', 'react-dom', 'react-router-dom'],
          chess:    ['chess.js', 'react-chessboard'],
          charts:   ['recharts'],
          query:    ['@tanstack/react-query'],
          socket:   ['socket.io-client'],
        },
      },
    },
  },
  // Exposes VITE_ env vars to the browser bundle
  envPrefix: 'VITE_',
})
