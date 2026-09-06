import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@riot/contracts': path.resolve(__dirname, '../packages/contracts/src'),
      '@riot/lcu': path.resolve(__dirname, '../packages/lcu/src'),
      '@riot/ui': path.resolve(__dirname, '../packages/ui/src'),
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      name: 'CompanionApp',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'index.js',
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
