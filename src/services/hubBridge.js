// The Jarvis hub bridge, protocol v1 — lets the owner's personal assistant (the Jarvis hub, running on their
// own computer) use Sartima when it shows the app in a frame.
//
// The app announces itself ("ready" plus its action list) and the hub sends { type: 'call', id, action,
// params }; the app answers { type: 'result', id, ok, result | error }. Same protocol as the hub's
// public/hub-bridge.js, as a module so React can install it on mount and remove it on unmount.
//
// Who may call: only the frame's own parent, and only from this app's origin, from localhost (the hub on
// its own computer) or from an origin listed in `origins` (the hub's address for a phone, say). Replies go
// to that origin alone. The "ready" announcement goes to any parent because the action list carries no
// user data.

const PROTO = 'jarvis-hub'

export function isHubOrigin(origin, ownOrigin, origins = []) {
  return origin === ownOrigin || origins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

/** "https://a.example, https://b.example" → the list, as the hub-origins build setting is written. */
export const parseOrigins = (value) => String(value ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)

export function actionList(def) {
  return Object.entries(def.actions).map(([name, a]) => ({
    name,
    description: a.description ?? '',
    params: a.params ?? {},
    writes: Boolean(a.writes),
  }))
}

const isCall = (d) =>
  Boolean(d) && typeof d === 'object' && d[PROTO] === 1 && d.type === 'call' &&
  typeof d.id === 'string' && typeof d.action === 'string'

/**
 * Answer the hub's calls and tell it the app is ready.
 * @param {{ app: string, actions: Record<string, { description: string, params?: object, writes?: boolean, run: (params: object) => unknown }> }} def
 * @param {Window} win  (a stand-in in tests)
 * @param {{ origins?: string[] }} options  hub origins allowed besides localhost
 * @returns {() => void} stops answering
 */
export function installHubBridge(def, win = window, { origins = [] } = {}) {
  const framed = win.parent !== win

  function onMessage(event) {
    const call = event.data
    if (!framed || !isCall(call)) return
    if (event.source !== win.parent || !isHubOrigin(event.origin, win.location.origin, origins)) return

    const hub = event.source
    const reply = (body) => hub.postMessage({ [PROTO]: 1, type: 'result', id: call.id, ...body }, event.origin)

    if (call.action === 'describe') {
      reply({ ok: true, result: { app: def.app, actions: actionList(def) } })
      return
    }
    const action = def.actions[call.action]
    if (!action) {
      reply({ ok: false, error: `Unknown action "${call.action}". Available: ${Object.keys(def.actions).join(', ')}` })
      return
    }
    Promise.resolve()
      .then(() => action.run(call.params ?? {}))
      // Round-trip through JSON so nothing that can't be cloned (a Firebase User, a Date) reaches postMessage.
      .then((result) => reply({ ok: true, result: result === undefined ? { ok: true } : JSON.parse(JSON.stringify(result)) }))
      .catch((err) => reply({ ok: false, error: err instanceof Error ? err.message : String(err) }))
  }

  win.addEventListener('message', onMessage)
  if (framed) {
    try {
      win.parent.postMessage({ [PROTO]: 1, type: 'ready', app: def.app, actions: actionList(def) }, '*')
    } catch {
      // a parent that can't be posted to isn't a hub
    }
  }
  return () => win.removeEventListener('message', onMessage)
}
