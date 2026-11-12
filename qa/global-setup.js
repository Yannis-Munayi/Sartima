// Runs once before each suite run: clears account locks left behind by a run
// that was stopped part-way.

import fs from 'node:fs'
import path from 'node:path'
import { RESULTS_DIR } from './lib/env.js'

export default async function globalSetup() {
  fs.rmSync(path.join(RESULTS_DIR, 'locks'), { recursive: true, force: true })
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
}
