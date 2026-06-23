import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(rootDir, '../wpx-app/package.json'))
const { defineConfig } = require('vitest/config')

export default defineConfig({
  root: rootDir,
  test: {
    globals: false,
    environment: 'node',
    setupFiles: [path.join(rootDir, 'test/setup.js')],
    include: ['__tests__/**/*.test.js'],
    testTimeout: 180_000,
    hookTimeout: 30_000,
  },
})
