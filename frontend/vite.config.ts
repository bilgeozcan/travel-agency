import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Default to localhost:3000 for local standalone mock/dev server when VITE_API_BASE_URL is unconfigured
  const targetApiUrl = env.VITE_API_BASE_URL || 'http://localhost:3000'

  return {
    base: process.env.NODE_ENV === 'production' ? '/travel-agency/' : '/',
    plugins: [react(), basicSsl()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: targetApiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
