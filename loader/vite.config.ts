import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    '__VERSION__': JSON.stringify(pkg.version),
    '__PLATFORM__': JSON.stringify(process.platform),
  },
  publicDir: false,
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src')
    }
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})