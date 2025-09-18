import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  const config = {
    plugins: [
      react(),
      {
        name: 'copy-redirects',
        writeBundle() {
          // Ensure dist directory exists
          if (!existsSync('dist')) {
            mkdirSync('dist', { recursive: true })
          }

          // Copy _redirects file to dist root for Render SPA routing
          const redirectsSrc = resolve('../_redirects')
          const redirectsDest = resolve('dist/_redirects')

          if (existsSync(redirectsSrc)) {
            copyFileSync(redirectsSrc, redirectsDest)
            console.log('✅ Copied _redirects file to dist/')
          } else {
            console.warn('⚠️  _redirects file not found in public/')
          }
        }
      }
    ],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Ensure SPA routing works by handling history API fallback
      rollupOptions: {
        output: {
          manualChunks: undefined,
        }
      }
    },
    publicDir: 'public'
  }

  // Only add proxy in development mode
  if (command === 'serve') {
    config.server = {
      port: 3001,
      proxy: {
        '/api': {
          target: 'http://localhost:3004',
          changeOrigin: true,
          secure: false,
        },
      },
    }
  }

  return config
})