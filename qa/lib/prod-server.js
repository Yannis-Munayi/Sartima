// A production build served by `vite preview`, started on demand for the
// checks that only work in one (service worker / offline shell, Sentry) when
// the rest of the run uses the dev server. Runs that never reach those checks
// never pay for the build.
//
// It builds into qa/results/prod-build (gitignored), so the app's own dist/
// is left alone, and serves on its own port so it can't collide with the
// suite's dev (5180) or preview (4180) servers.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { RESULTS_ROOT, ROOT } from './env.js'

export const PROD_PORT = 4181
const OUT_DIR = path.join(RESULTS_ROOT, 'prod-build')
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Keeps the last few KB of a child's output, for error messages. */
function tail(child) {
  let out = ''
  const keep = (chunk) => { out = (out + chunk).slice(-4000) }
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)
  return () => out.trim()
}

async function build() {
  // Plain node + vite.js (no shell), so the process can be killed on Windows
  const child = spawn(process.execPath, [VITE, 'build', '--outDir', OUT_DIR, '--emptyOutDir'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = tail(child)
  const code = await new Promise((resolve) => {
    child.on('error', () => resolve(-1))
    child.on('exit', resolve)
  })
  if (code !== 0) throw new Error(`Production build failed (exit ${code}):\n${output()}`)
}

async function waitForServer(url, child, output, timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`vite preview exited (code ${child.exitCode}):\n${output()}`)
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* not listening yet */ }
    await sleep(300)
  }
  child.kill()
  throw new Error(`vite preview didn't answer on ${url} within ${timeoutMs / 1000}s:\n${output()}`)
}

/** Builds the app and serves it. Resolves to { url, stop }. */
export async function startProdServer() {
  await build()
  const url = `http://localhost:${PROD_PORT}`
  const child = spawn(process.execPath, [VITE, 'preview', '--outDir', OUT_DIR, '--port', String(PROD_PORT), '--strictPort'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = tail(child)
  await waitForServer(url, child, output)
  return { url, stop: () => { if (child.exitCode === null) child.kill() } }
}
