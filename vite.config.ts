import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Docker on Windows/macOS bind mounts don't forward file-system events, so the
// container opts into polling with CHOKIDAR_USEPOLLING=true (see docker-compose.yml).
const usePolling = process.env.CHOKIDAR_USEPOLLING === 'true'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('dexie')) return 'db'
          if (id.includes('radix-ui') || id.includes('@radix-ui')) return 'ui'
          if (id.includes('react-router')) return 'router'
          if (/[\\/]react(-dom)?[\\/]/.test(id) || id.includes('scheduler')) return 'react'
          return undefined
        },
      },
    },
  },
})
