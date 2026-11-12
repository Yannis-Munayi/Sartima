import { describe, it, expect, vi } from 'vitest'
import { installHubBridge, isHubOrigin, parseOrigins, actionList } from '../../src/services/hubBridge.js'

const OWN = 'https://sartima.ca'

// A stand-in window: `framed` gives it a separate parent that records posts
function fakeWindow({ framed = true } = {}) {
  const listeners = new Set()
  const parent = { posts: [], postMessage(msg, origin) { this.posts.push({ msg, origin }) } }
  const win = {
    location: { origin: OWN },
    addEventListener: (type, fn) => type === 'message' && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
    dispatch(data, { origin = 'http://localhost:8080', source } = {}) {
      for (const fn of listeners) fn({ data, origin, source: source ?? win.parent })
    },
    listenerCount: () => listeners.size,
  }
  win.parent = framed ? parent : win
  return win
}

const call = (action, params, id = 'c1') => ({ 'jarvis-hub': 1, type: 'call', id, action, params })
const flush = () => new Promise((r) => setTimeout(r, 0))

const def = {
  app: 'sartima',
  actions: {
    echo: { description: 'Echo', params: { x: 'any' }, run: (p) => ({ got: p.x }) },
    save: { description: 'Writes', writes: true, run: () => undefined },
    boom: { description: 'Fails', run: () => { throw new Error('nope') } },
    date: { description: 'Returns a Date', run: () => ({ at: new Date('2026-01-01T00:00:00Z') }) },
  },
}

describe('isHubOrigin / parseOrigins', () => {
  it('allows the app itself, localhost and listed origins only', () => {
    expect(isHubOrigin(OWN, OWN)).toBe(true)
    expect(isHubOrigin('http://localhost:3000', OWN)).toBe(true)
    expect(isHubOrigin('http://127.0.0.1', OWN)).toBe(true)
    expect(isHubOrigin('https://hub.example', OWN, ['https://hub.example'])).toBe(true)
    expect(isHubOrigin('https://evil.example', OWN)).toBe(false)
    expect(isHubOrigin('http://localhost.evil.example', OWN)).toBe(false)
  })

  it('parses the comma-separated build setting', () => {
    expect(parseOrigins(' https://a.example/ , https://b.example,, ')).toEqual(['https://a.example', 'https://b.example'])
    expect(parseOrigins(undefined)).toEqual([])
  })
})

describe('actionList', () => {
  it('describes each action with its params and whether it writes', () => {
    expect(actionList(def)).toContainEqual({ name: 'save', description: 'Writes', params: {}, writes: true })
    expect(actionList(def)).toContainEqual({ name: 'echo', description: 'Echo', params: { x: 'any' }, writes: false })
  })
})

describe('installHubBridge', () => {
  it('announces "ready" with the action list when framed', () => {
    const win = fakeWindow()
    installHubBridge(def, win)
    expect(win.parent.posts[0].msg).toMatchObject({ 'jarvis-hub': 1, type: 'ready', app: 'sartima' })
    expect(win.parent.posts[0].origin).toBe('*')
  })

  it('answers describe and runs actions, replying only to the caller origin', async () => {
    const win = fakeWindow()
    installHubBridge(def, win)
    win.dispatch(call('describe', {}, 'd1'))
    win.dispatch(call('echo', { x: 42 }, 'e1'))
    await flush()
    const replies = win.parent.posts.slice(1)
    expect(replies[0]).toMatchObject({ msg: { type: 'result', id: 'd1', ok: true, result: { app: 'sartima' } }, origin: 'http://localhost:8080' })
    expect(replies[1].msg).toMatchObject({ id: 'e1', ok: true, result: { got: 42 } })
  })

  it('reports failures and unknown actions as errors', async () => {
    const win = fakeWindow()
    installHubBridge(def, win)
    win.dispatch(call('boom', {}, 'b1'))
    win.dispatch(call('missing', {}, 'm1'))
    await flush()
    const byId = Object.fromEntries(win.parent.posts.slice(1).map((p) => [p.msg.id, p.msg]))
    expect(byId.b1).toMatchObject({ ok: false, error: 'nope' })
    expect(byId.m1.ok).toBe(false)
    expect(byId.m1.error).toMatch(/Unknown action "missing"/)
  })

  it('makes results cloneable and turns undefined into { ok: true }', async () => {
    const win = fakeWindow()
    installHubBridge(def, win)
    win.dispatch(call('date', {}, 'dt'))
    win.dispatch(call('save', {}, 'sv'))
    await flush()
    const byId = Object.fromEntries(win.parent.posts.slice(1).map((p) => [p.msg.id, p.msg]))
    expect(byId.dt.result).toEqual({ at: '2026-01-01T00:00:00.000Z' })
    expect(byId.sv.result).toEqual({ ok: true })
  })

  it('ignores calls from other origins, other sources and malformed messages', async () => {
    const win = fakeWindow()
    const run = vi.fn()
    installHubBridge({ app: 'sartima', actions: { x: { run } } }, win)
    win.dispatch(call('x'), { origin: 'https://evil.example' })
    win.dispatch(call('x'), { source: { postMessage() {} } })
    win.dispatch({ type: 'call', id: 'no-proto', action: 'x' })
    win.dispatch({ 'jarvis-hub': 1, type: 'call', id: 5, action: 'x' })
    await flush()
    expect(run).not.toHaveBeenCalled()
    expect(win.parent.posts).toHaveLength(1) // only "ready"
  })

  it('accepts a configured hub origin', async () => {
    const win = fakeWindow()
    installHubBridge(def, win, { origins: ['https://phone-hub.example'] })
    win.dispatch(call('echo', { x: 1 }), { origin: 'https://phone-hub.example' })
    await flush()
    expect(win.parent.posts.at(-1)).toMatchObject({ origin: 'https://phone-hub.example', msg: { ok: true } })
  })

  it('does nothing when the app is not in a frame', async () => {
    const win = fakeWindow({ framed: false })
    const run = vi.fn()
    installHubBridge({ app: 'sartima', actions: { x: { run } } }, win)
    win.dispatch(call('x'), { source: win })
    await flush()
    expect(run).not.toHaveBeenCalled()
  })

  it('stops answering once uninstalled', () => {
    const win = fakeWindow()
    const stop = installHubBridge(def, win)
    expect(win.listenerCount()).toBe(1)
    stop()
    expect(win.listenerCount()).toBe(0)
  })
})
