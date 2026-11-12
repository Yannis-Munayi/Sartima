// Unit + backend tests (Vitest). Kept apart from vite.config.js so the PWA
// plugin and chunking config never load in tests.
//   npm test               → unit (src logic) + functions (Cloud Functions, mocked)
//   npm run test:rules     → Firestore / Storage rules against the emulator
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'functions',
          include: ['functions/test/**/*.test.js'],
          setupFiles: ['functions/test/setup.js'],
          environment: 'node',
          restoreMocks: false,
          unstubGlobals: true,
        },
      },
      {
        test: {
          name: 'rules',
          include: ['tests/rules/**/*.test.js'],
          environment: 'node',
          // One emulator shared by every file: run them one at a time
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
