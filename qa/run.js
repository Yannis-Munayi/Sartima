// Runs the checklist suite from the terminal, without the dashboard:
//   npm run qa:local [-- extra playwright args]
//   npm run qa:live  [-- -g "Search"]
// Results still land in qa/results/<target>/ (the dashboard reads report.json
// only for runs it starts itself).

import { spawn } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const [target = 'local', ...rest] = process.argv.slice(2)
if (!['local', 'live'].includes(target)) {
  console.error('Usage: node qa/run.js <local|live> [playwright args]')
  process.exit(1)
}
const qaDir = path.dirname(fileURLToPath(import.meta.url))
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli')
const child = spawn(process.execPath, [cli, 'test', '-c', path.join(qaDir, 'playwright.config.js'), ...rest], {
  cwd: path.resolve(qaDir, '..'),
  env: { ...process.env, QA_TARGET: target },
  stdio: 'inherit',
})
child.on('close', (code) => process.exit(code ?? 1))
