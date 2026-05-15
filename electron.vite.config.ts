import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const nodeExternals = [
  'better-sqlite3',
  'keytar',
  'electron-updater',
  'uuid',
  'bcryptjs',
  'speakeasy',
  'qrcode',
  'csv-stringify'
]

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: nodeExternals
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    plugins: [react()]
  }
})
