import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  build: { target: 'esnext' },
  test: { include: ['test/**/*.test.ts'], setupFiles: ['test/setup.ts'], testTimeout: 120000 },
})
