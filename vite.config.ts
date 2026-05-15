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

// Plugin to handle @ alias
function aliasPlugin(srcDir: string) {
  return {
    name: 'alias-src',
    enforce: 'pre' as const,
    async resolveId(id: string, importer: string | undefined, options: Record<string, unknown>) {
      if (id.startsWith('@/')) {
        const resolved = resolve(srcDir, id.slice(2))
        // Try to resolve with extensions
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.js']
        const fs = await import('fs')
        for (const ext of ['', ...extensions]) {
          const candidate = resolved + ext
          if (fs.existsSync(candidate)) {
            return candidate
          }
        }
        return resolved
      }
      return null
    }
  }
}

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
    root: '.',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    },
    plugins: [
      react(),
      aliasPlugin(resolve(__dirname, 'src'))
    ]
  }
})
