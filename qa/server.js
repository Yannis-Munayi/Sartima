// Sartima QA dashboard — a local-only server (127.0.0.1) that runs the
// checklist suite against the local app or the live site, keeps each run's
// results and failure artifacts, and serves the dashboard page.
//
//   npm run qa            → http://127.0.0.1:4545
//
// Nothing here is part of the app: it isn't imported by src/, bundled by
// Vite, or deployed by Firebase Hosting (which only serves dist/).

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { QA_DIR, ROOT, RESULTS_ROOT, setupSummary, LIVE_URL, FLAG_NAMES } from './lib/env.js'

const PORT = Number(process.env.QA_DASHBOARD_PORT || 4545)
const HOST = '127.0.0.1'
const TARGETS = ['local', 'live']
const HISTORY_KEEP = 60
const RUN_DIRS_KEEP = 15
const require = createRequire(import.meta.url)
const PW_CLI = require.resolve('@playwright/test/cli')

fs.mkdirSync(RESULTS_ROOT, { recursive: true })

// ── Small file helpers ───────────────────────────────────────────────────────

const targetDir = (t) => path.join(RESULTS_ROOT, t)
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2))
  fs.renameSync(file + '.tmp', file)
}
// eslint-disable-next-line no-control-regex
const stripAnsi = (s = '') => String(s).replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)

const SETTINGS_FILE = path.join(RESULTS_ROOT, 'settings.json')
const defaultSettings = { schedule: { local: 0, live: 0 }, localMode: 'dev' }
const settings = () => ({ ...defaultSettings, ...readJson(SETTINGS_FILE, {}) })

const latestFile  = (t) => path.join(targetDir(t), 'latest.json')
const historyFile = (t) => path.join(targetDir(t), 'history.json')
const manualFile  = (t) => path.join(targetDir(t), 'manual.json')
const logFile     = (t) => path.join(targetDir(t), 'last-run.log')

// ── Live updates (server-sent events) ────────────────────────────────────────

const clients = new Set()
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) res.write(msg)
}

// ── Running the suite ────────────────────────────────────────────────────────

let running = null // { target, child, startedAt, trigger, scope, total, done, failed, log: [] }

/** Only the known 0/1 flags, only as '0' or '1'. Anything else is dropped. */
function cleanFlags(flags) {
  const out = {}
  for (const [k, v] of Object.entries(flags ?? {})) {
    if (FLAG_NAMES.includes(k) && (String(v) === '0' || String(v) === '1')) out[k] = String(v)
  }
  return out
}

/** The flags a test said it was missing (fixtures.js `needs-flag` labels). */
const neededFlags = (t) => (t.annotations ?? []).filter((a) => a.type === 'needs-flag').map((a) => a.description)

function startRun(target, { scope = 'all', ids = [], trigger = 'manual', flags = {} } = {}) {
  if (running) return { ok: false, error: `A ${running.target} run is already in progress.` }
  if (!TARGETS.includes(target)) return { ok: false, error: 'Unknown target' }
  const s = settings()
  const args = [PW_CLI, 'test', '-c', path.join(QA_DIR, 'playwright.config.js')]
  // Flags apply to this run only; qa/.env keeps its values for every other run
  const runFlags = cleanFlags(flags)
  if (scope === 'failed' || scope === 'tests' || scope === 'setup') {
    const known = readJson(latestFile(target), null)?.tests ?? []
    const picked = scope === 'failed'
      ? known.filter((t) => t.status === 'failed' || t.status === 'flaky')
      : scope === 'setup'
        ? known.filter((t) => t.status === 'setup' && neededFlags(t).length)
        : known.filter((t) => ids.includes(t.id))
    if (!picked.length) {
      return {
        ok: false,
        error: scope === 'failed' ? 'Nothing is failing.'
          : scope === 'setup' ? 'No skipped test is waiting on a flag.'
          : 'No tests given.',
      }
    }
    // Turn on what the picked tests asked for (explicit flags still win)
    if (scope === 'setup') {
      for (const f of picked.flatMap(neededFlags)) runFlags[f] ??= '1'
    }
    args.push(...selectTests(picked))
  }
  const env = {
    ...process.env,
    ...runFlags,
    QA_TARGET: target,
    QA_LOCAL_MODE: s.localMode,
    FORCE_COLOR: '0',
    CI: '',
  }
  // Each run starts from a fresh JSON report
  fs.rmSync(path.join(targetDir(target), 'report.json'), { force: true })
  const child = spawn(process.execPath, args, { cwd: ROOT, env })
  running = {
    target, child, trigger, scope,
    startedAt: new Date().toISOString(),
    total: null, done: 0, failed: 0, log: [],
    localMode: target === 'local' ? s.localMode : null,
    flags: runFlags,
  }
  broadcast('state', { running: publicRunning() })

  let buf = ''
  const onData = (chunk) => {
    buf += chunk.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop()
    for (const raw of lines) {
      const line = stripAnsi(raw)
      running.log.push(line)
      if (running.log.length > 4000) running.log.shift()
      const total = line.match(/Running (\d+) tests? using/)
      if (total) running.total = Number(total[1])
      const step = line.match(/^\s*(✓|✘|ok|x|-|°)\s+(\d+)\s/)
      if (step) {
        running.done = Math.max(running.done, Number(step[2]))
        if (step[1] === '✘' || step[1] === 'x') running.failed += 1
      }
      broadcast('log', { target, line, done: running.done, total: running.total, failed: running.failed })
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('close', (code) => {
    const finished = running
    running = null
    try { fs.writeFileSync(logFile(target), finished.log.join('\n')) } catch { /* */ }
    let summary
    try {
      summary = ingest(target, finished, code)
    } catch (err) {
      summary = { error: `Couldn't read the report: ${err.message}` }
      console.error(`[qa] ${target}: ${summary.error}`)
    }
    broadcast('state', { running: null, finished: { target, code, summary } })
  })
  return { ok: true }
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Playwright args that select these tests by file + title. Not `file:line`:
 * the stored line numbers go stale as soon as a spec is edited, and a stale
 * line selects nothing ("No tests found"), leaving the old result on screen.
 */
function selectTests(tests) {
  const files = [...new Set(tests.map((t) => escapeRegex(t.file)))]
  const titles = [...new Set(tests.map((t) => `${escapeRegex(t.title)}$`))]
  return [...files, '--grep', titles.join('|')]
}

function publicRunning() {
  if (!running) return null
  const { target, startedAt, trigger, scope, total, done, failed, localMode, flags } = running
  return { target, startedAt, trigger, scope, total, done, failed, localMode, flags }
}

function stopRun() {
  if (!running) return
  running.stopped = true
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(running.child.pid), '/T', '/F'])
    else running.child.kill('SIGTERM')
  } catch { /* already gone */ }
}

// ── Turning Playwright's JSON report into dashboard results ─────────────────

function statusOf(test, result, annotations) {
  if (test.status === 'skipped') {
    if (annotations.some((a) => a.type === 'manual')) return 'manual'
    if (annotations.some((a) => a.type === 'needs-setup')) return 'setup'
    return 'skipped'
  }
  if (test.status === 'expected') return 'passed'
  if (test.status === 'flaky') return 'flaky'
  if (result?.status === 'interrupted') return 'interrupted'
  return 'failed'
}

function collectSpecs(suite, trail, out) {
  const here = suite.title && !/\.spec\.js$/.test(suite.title) ? [...trail, suite.title] : trail
  for (const spec of suite.specs ?? []) out.push({ spec, trail: here })
  for (const child of suite.suites ?? []) collectSpecs(child, here, out)
}

function ingest(target, run, exitCode) {
  const dir = targetDir(target)
  const report = readJson(path.join(dir, 'report.json'), null)
  if (!report) throw new Error(run.stopped ? 'the run was stopped before it produced a report' : 'no report.json was written')

  const runId = `${run.startedAt.replace(/[:.]/g, '-')}`
  const runDir = path.join(dir, 'runs', runId)
  const specs = []
  for (const s of report.suites ?? []) collectSpecs(s, [], specs)

  const tests = []
  for (const { spec, trail } of specs) {
    const t = spec.tests?.[0]
    if (!t) continue
    const result = t.results?.at(-1) ?? null
    const annotations = []
    const seen = new Set()
    for (const a of [...(t.annotations ?? []), ...(result?.annotations ?? [])]) {
      const key = `${a.type}|${a.description}`
      if (!seen.has(key)) { seen.add(key); annotations.push({ type: a.type, description: a.description ?? '' }) }
    }
    const file = path.basename(spec.file)
    const id = `${file}::${[...trail, spec.title].join(' › ')}`
    const status = statusOf(t, result, annotations)
    const err = result?.error ?? result?.errors?.[0] ?? null
    const testDir = path.join(runDir, hash(id))

    const attachments = []
    if (status === 'failed' || status === 'flaky') {
      for (const a of result?.attachments ?? []) {
        if (!a.path || !fs.existsSync(a.path)) continue
        fs.mkdirSync(testDir, { recursive: true })
        const dest = path.join(testDir, `${attachments.length}-${path.basename(a.path)}`)
        fs.copyFileSync(a.path, dest)
        attachments.push({
          name: a.name,
          contentType: a.contentType,
          url: '/artifacts/' + path.relative(RESULTS_ROOT, dest).split(path.sep).join('/'),
        })
      }
    }

    tests.push({
      id,
      file,
      line: spec.line,
      section: trail[0] ?? file,
      group: trail.slice(1).join(' › '),
      title: spec.title,
      status,
      duration: result?.duration ?? 0,
      retries: Math.max(0, (t.results?.length ?? 1) - 1),
      annotations,
      error: err ? {
        message: stripAnsi(err.message ?? ''),
        stack: stripAnsi(err.stack ?? ''),
        snippet: stripAnsi(err.snippet ?? ''),
        location: err.location ? `${path.basename(err.location.file)}:${err.location.line}` : null,
      } : null,
      stdout: (result?.stdout ?? []).map((o) => o.text ?? '').join('').slice(-6000),
      attachments,
      runId,
      ranAt: result?.startTime ?? run.startedAt,
      flags: run.flags ?? {},
    })
  }

  // Partial runs update only the tests they ran
  const previous = readJson(latestFile(target), { tests: [] })
  const partial = run.scope !== 'all'
  const merged = partial
    ? [...previous.tests.filter((t) => !tests.some((n) => n.id === t.id)), ...tests]
    : tests

  const counts = countStatuses(tests)
  const history = readJson(historyFile(target), [])
  history.push({
    runId,
    startedAt: run.startedAt,
    finishedAt: new Date().toISOString(),
    trigger: run.trigger,
    scope: run.scope,
    localMode: run.localMode,
    flags: run.flags ?? {},
    exitCode,
    stopped: Boolean(run.stopped),
    counts,
    results: Object.fromEntries(tests.map((t) => [t.id, t.status])),
  })
  while (history.length > HISTORY_KEEP) history.shift()
  writeJson(historyFile(target), history)

  const latest = {
    updatedAt: new Date().toISOString(),
    lastRun: history.at(-1),
    tests: merged.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
  }
  writeJson(latestFile(target), latest)
  pruneRunDirs(target, latest)
  return { counts, partial }
}

function countStatuses(tests) {
  const c = { passed: 0, failed: 0, flaky: 0, setup: 0, manual: 0, skipped: 0, interrupted: 0, total: tests.length }
  for (const t of tests) c[t.status] = (c[t.status] ?? 0) + 1
  return c
}

function pruneRunDirs(target, latest) {
  const runsDir = path.join(targetDir(target), 'runs')
  let dirs
  try { dirs = fs.readdirSync(runsDir).sort() } catch { return }
  const keep = new Set(dirs.slice(-RUN_DIRS_KEEP))
  for (const t of latest.tests) keep.add(t.runId)
  for (const d of dirs) if (!keep.has(d)) fs.rmSync(path.join(runsDir, d), { recursive: true, force: true })
}

// ── State for the page ───────────────────────────────────────────────────────

function targetState(target) {
  const latest = readJson(latestFile(target), null)
  const history = readJson(historyFile(target), [])
  const manual = readJson(manualFile(target), {})
  const tests = (latest?.tests ?? []).map((t) => {
    // How long has this test been failing? Walk back through runs that included it.
    let since = null
    let streak = 0
    if (t.status === 'failed') {
      for (let i = history.length - 1; i >= 0; i--) {
        const s = history[i].results?.[t.id]
        if (s === undefined) continue
        if (s === 'failed') { since = history[i].startedAt; streak += 1 } else break
      }
    }
    const trail = history.slice(-20).map((h) => h.results?.[t.id] ?? null)
    return { ...t, failingSince: since, failStreak: streak, trail, manualCheck: manual[t.id] ?? null }
  })
  return {
    target,
    url: target === 'live' ? LIVE_URL : null,
    lastRun: latest?.lastRun ?? null,
    counts: countStatuses(tests),
    tests,
    history: history.slice(-30).map(({ runId, startedAt, finishedAt, trigger, scope, counts, stopped }) =>
      ({ runId, startedAt, finishedAt, trigger, scope, counts, stopped })),
  }
}

function fullState() {
  return {
    targets: Object.fromEntries(TARGETS.map((t) => [t, targetState(t)])),
    running: publicRunning(),
    settings: settings(),
    setup: setupSummary(),
  }
}

// ── Scheduled runs (only while this server is running) ───────────────────────

const bootedAt = Date.now()
setInterval(() => {
  if (running || Date.now() - bootedAt < 2 * 60 * 1000) return
  const { schedule } = settings()
  for (const target of TARGETS) {
    const every = Number(schedule?.[target] ?? 0)
    if (!every) continue
    const last = readJson(historyFile(target), []).filter((h) => h.scope === 'all').at(-1)
    const lastAt = last ? Date.parse(last.finishedAt) : 0
    if (Date.now() - lastAt >= every * 60 * 1000) {
      startRun(target, { trigger: 'schedule' })
      return
    }
  }
}, 60 * 1000)

// ── HTTP ─────────────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webm': 'video/webm', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

async function readBody(req) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
    if (data.length > 1e6) throw new Error('body too large')
  }
  return data ? JSON.parse(data) : {}
}

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'Not found' })
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': st.size })
    fs.createReadStream(file).pipe(res)
  })
}

const server = http.createServer(async (req, res) => {
  // Only this machine, by name — blocks DNS-rebinding pages from reaching the API
  const host = (req.headers.host ?? '').toLowerCase()
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return send(res, 403, { error: 'Forbidden' })

  const url = new URL(req.url, `http://${host}`)
  const p = url.pathname

  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    return serveFile(res, path.join(QA_DIR, 'dashboard', 'index.html'))
  }
  if (req.method === 'GET' && p === '/api/state') return send(res, 200, fullState())
  if (req.method === 'GET' && p === '/api/log') {
    const target = url.searchParams.get('target')
    if (running?.target === target) return send(res, 200, { lines: running.log })
    let text = ''
    try { text = fs.readFileSync(logFile(target), 'utf8') } catch { /* none yet */ }
    return send(res, 200, { lines: text ? text.split('\n') : [] })
  }
  if (req.method === 'GET' && p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
    res.write('retry: 3000\n\n')
    clients.add(res)
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
    req.on('close', () => { clearInterval(ping); clients.delete(res) })
    return
  }
  if (req.method === 'GET' && p.startsWith('/artifacts/')) {
    const rel = decodeURIComponent(p.slice('/artifacts/'.length))
    const file = path.resolve(RESULTS_ROOT, rel)
    if (!file.startsWith(RESULTS_ROOT + path.sep) || /[\\/]auth[\\/]/.test(file)) return send(res, 403, { error: 'Forbidden' })
    return serveFile(res, file)
  }

  if (req.method === 'POST') {
    // Custom header: a cross-site page can't send it without a preflight we never answer
    if (req.headers['x-qa-dashboard'] !== '1') return send(res, 403, { error: 'Forbidden' })
    let body
    try { body = await readBody(req) } catch { return send(res, 400, { error: 'Bad body' }) }

    if (p === '/api/run') {
      const r = startRun(body.target, {
        scope: body.scope ?? 'all', ids: body.ids ?? [], trigger: 'manual', flags: body.flags ?? {},
      })
      return send(res, r.ok ? 202 : 409, r)
    }
    if (p === '/api/stop') { stopRun(); return send(res, 200, { ok: true }) }
    if (p === '/api/settings') {
      const next = settings()
      if (body.schedule) {
        for (const t of TARGETS) {
          if (body.schedule[t] !== undefined) next.schedule[t] = Math.max(0, Number(body.schedule[t]) || 0)
        }
      }
      if (body.localMode === 'dev' || body.localMode === 'preview') next.localMode = body.localMode
      writeJson(SETTINGS_FILE, next)
      broadcast('state', {})
      return send(res, 200, next)
    }
    if (p === '/api/manual') {
      if (!TARGETS.includes(body.target) || !body.id) return send(res, 400, { error: 'target and id required' })
      const m = readJson(manualFile(body.target), {})
      if (body.status === null) delete m[body.id]
      else m[body.id] = { status: body.status === 'failed' ? 'failed' : 'passed', note: String(body.note ?? '').slice(0, 500), at: new Date().toISOString() }
      writeJson(manualFile(body.target), m)
      broadcast('state', {})
      return send(res, 200, { ok: true })
    }
    if (p === '/api/trace') {
      const rel = String(body.url ?? '').replace(/^\/artifacts\//, '')
      const file = path.resolve(RESULTS_ROOT, decodeURIComponent(rel))
      if (!file.startsWith(RESULTS_ROOT + path.sep) || !file.endsWith('.zip') || !fs.existsSync(file)) {
        return send(res, 400, { error: 'No such trace' })
      }
      spawn(process.execPath, [PW_CLI, 'show-trace', file], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref()
      return send(res, 200, { ok: true })
    }
  }
  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, HOST, () => {
  console.log(`Sartima QA dashboard → http://${HOST}:${PORT}  (local only; Ctrl+C to stop)`)
})
