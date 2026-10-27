import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const standaloneWebsiteRoot = fileURLToPath(new URL('../website/', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  root: command === 'serve' && mode !== 'app' ? standaloneWebsiteRoot : frontendRoot,
  plugins: [react()],
  server: {
    port: mode === 'app' ? 5175 : 5174,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  }
}))