/**
 * Sartima taste model (ranking algorithm)
 * ------------------------------------------------------------------------
 * Pure JS, no React / Firestore / catalog imports. Sartima-specific wiring
 * (catalog shape, the shared instance, signal → event mapping, migration)
 * lives in tasteProfile.js.
 *
 * Principles
 *   1. Signed scores: dislikes are negative affinity, not just "less positive".
 *   2. Decay: every tally fades (aesthetic 60d, brand/type 90d, color 45d,
 *      search 3d, session layer 20min). Decay is lazy: values are stored as
 *      {v, t} and decayed when read, so no background job is needed.
 *   3. Exposure-aware: brand / type / color learn from a smoothed
 *      liked-per-shown rate, so a skip only counts relative to impressions.
 *   4. Cosine match, not summed weights: a product tagged with many
 *      aesthetics does not win just for being broad.
 *   5. Explicit exploration: low-exposure aesthetics get a bonus, and a share
 *      of every batch is reserved for adjacent / wildcard aesthetics.
 *
 * Persistence
 *   The profile is plain JSON. Do NOT write deltas from several tabs. Queue
 *   *events* (as interestTracker does), then, after the 2s debounce:
 *
 *     runTransaction(db, async tx => {
 *       const snap = await tx.get(ref);
 *       const profile = snap.exists() ? snap.data().taste : model.createProfile();
 *       model.applyEvents(profile, queuedEvents);
 *       tx.set(ref, { taste: profile }, { merge: true });
 *     });
 *
 *   Replaying events inside the transaction keeps writes from two devices
 *   additive instead of overwriting each other.
 *
 * Product shape expected (tasteProfile.js normalises the catalog into this):
 *   { id, name, brand, brandName?, type, parentType, color, price,
 *     description?, popularity? (0..1), styleWeights: {aestheticId: 1..5},
 *     outfitCompanions?: { types?: string[], ids?: string[] } }
 * Ids must be Firestore-safe map keys (slugs, no "/" or ".").
 */

const DAY = 86400000;
const MIN = 60000;

export const DEFAULTS = {
  halfLife: { aes: 60 * DAY, brand: 90 * DAY, type: 90 * DAY, color: 45 * DAY, search: 3 * DAY, session: 20 * MIN },

  // aes = points added to the aesthetic tally (spread by attribution weights).
  // attr = points for brand / type / color; a plain like (attr 2) equals 1 "unit".
  events: {
    closet_add: { aes: 6, attr: 4 },
    worn:       { aes: 6, attr: 4 },
    save:       { aes: 5, attr: 3 },
    like:       { aes: 3, attr: 2 },
    tryon:      { aes: 3, attr: 1.5 },
    shop_click: { aes: 3, attr: 2 },
    view:       { aes: 0.5, attr: 0.25 },   // scaled by dwell: 0 under 2s, full at 5s+
    hide:       { aes: -6, attr: -3 },
    pin: 8,                                  // explicit aesthetic pin
    search: { aes: 1.5, attr: 1.5, repeatMult: 2, repeatWindow: 7 * DAY },
    onboardBrand: 2.5,                       // units added to a favourite brand picked at onboarding
    quizSeed: 8                              // tally points for a 100% quiz aesthetic
  },
  reverse: { unlike: 'like', unsave: 'save' },

  skip: { aesFactor: 0.4, minRawWeight: 4, runLength: 3, runPenalty: 3 },
  rate: { priorStrength: 6, scale: 4 },       // smoothed rate = (pos + prior*p0) / (shown + prior)
  aesScaleFloor: 4,                           // tanh(tally / max(floor, p90 of |tally|))

  weights: { aesthetic: 0.40, type: 0.15, brand: 0.12, color: 0.08, price: 0.08, closet: 0.07, explore: 0.10, search: 0.05 },
  closetMix: { gap: 0.6, companion: 0.4 },
  penalties: { nearDuplicate: 0.3, recentUnacted: 0.2, hardExcludeCos: -0.5, hardExcludeMinEvidence: 15 },

  explore: { c: 1, adjacentShare: 0.10, wildcardShare: 0.05, bump: 0.25, minEventsForAdjacent: 8 },
  mmr: { lambda: 0.3, poolSize: 120, simStyle: 0.5, simBrand: 0.25, simType: 0.25 },

  // Confidence / cold start: below `low` evidence lean on quiz + popularity, above `high` the learned profile dominates.
  confidence: { low: 15, high: 60, priorWeightLow: 0.6, priorWeightHigh: 0.05, prior: { quiz: 0.4, popularity: 0.2 } },

  sessionBlend: { start: 0.2, end: 0.5, eventsToEnd: 40 },
  limits: { touches: 400, prices: 40, hidden: 500, searchMaxAge: 30 * DAY },

  // Random tie-break added to every score. Many products share an identical
  // style vector, brand and type; without this, ties resolve in catalog order
  // and a returning user sees the same items every visit.
  jitter: 0.02
};

/* ---------------------------------------------------------------- helpers */

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const decayF = (dt, hl) => (dt <= 0 ? 1 : Math.pow(0.5, dt / hl));
const tokenize = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const hasPrice = p => Number.isFinite(p.price) && p.price > 0;

// {v,t} decayed scalar
const readV = (x, now, hl) => (x ? x.v * decayF(now - x.t, hl) : 0);
const addV = (map, key, delta, now, hl) => { map[key] = { v: readV(map[key], now, hl) + delta, t: now }; };
// {shown,pos,t} decayed counter
const readC = (c, now, hl) => { if (!c) return { shown: 0, pos: 0 }; const f = decayF(now - c.t, hl); return { shown: c.shown * f, pos: c.pos * f }; };
const addC = (map, key, dShown, dPos, now, hl) => {
  const r = readC(map[key], now, hl);
  map[key] = { shown: r.shown + dShown, pos: Math.max(0, r.pos + dPos), t: now };
};

export function createProfile(now = Date.now()) {
  return {
    v: 1, updatedAt: now, evidence: 0,
    aes: {},                      // {aestheticId: {v,t}}  long-term signed tally
    brand: {}, type: {}, color: {},   // {id: {shown,pos,t}}
    global: { shown: 0, pos: 0, t: now },
    expo: {},                     // {aestheticId: impressions where it was the product's main aesthetic}
    prices: [],                   // [{lp (ln price), w, t}] from positive events
    searches: {},                 // {query: {v,t,count,first,last,engaged}}
    touches: {},                  // {productId: {n, d:{eventType: dayIndex}, t}}
    hidden: [],                   // product ids the user said "not for me"
    quiz: null                    // {aestheticId: pct 0..100}
  };
}

/** In-memory only. Create one per visit; never persist. */
export function createSession(now = Date.now()) {
  return { aes: {}, events: 0, run: 0, lastMain: null, startedAt: now };
}

/* ------------------------------------------------------------------ model */

export class TasteModel {
  /**
   * @param {{catalog: object[], aesthetics: string[], config?: object}} opts
   * `aesthetics` is the list of all aesthetic ids (the 51).
   */
  constructor({ catalog, aesthetics, config = {} }) {
    this.cfg = deepMerge(DEFAULTS, config);
    this.aesthetics = aesthetics;
    this.items = [];
    this.byId = new Map();
    this.vec = new Map();
    this.tokens = new Map();
    this.vocab = [];
    this._searchCache = new Map();
    const seenVocab = new Set();

    for (const p of catalog) {
      const raw = p.styleWeights || {};
      const ids = Object.keys(raw).filter(a => raw[a] > 0);
      if (!ids.length) continue;
      const sq = {}; let sum = 0, nrm = 0;
      for (const a of ids) { sq[a] = raw[a] * raw[a]; sum += sq[a]; nrm += sq[a] * sq[a]; }
      nrm = Math.sqrt(nrm);
      const w = {}, sv = {};
      let main = ids[0];
      for (const a of ids) { w[a] = sq[a] / sum; sv[a] = sq[a] / nrm; if (raw[a] > raw[main]) main = a; }
      this.items.push(p);
      this.byId.set(p.id, p);
      this.vec.set(p.id, { raw, w, sv, main });
      this.tokens.set(p.id, new Set(tokenize([p.name, p.brandName || p.brand, p.type, p.color, p.description].join(' '))));
      for (const [kind, id, label] of [['brand', p.brand, p.brandName || p.brand], ['type', p.type, p.type], ['color', p.color, p.color]]) {
        const key = kind + ':' + id;
        if (!seenVocab.has(key)) { seenVocab.add(key); this.vocab.push({ kind, id, phrase: tokenize(label).join(' ') }); }
      }
    }
    this.adj = this._buildAdjacency();
  }

  /* ---- adjacency: top-3 neighbours per aesthetic from catalog co-occurrence ---- */
  _buildAdjacency() {
    const dot = {}, nrm = {};
    for (const { sv } of this.vec.values()) {
      const ks = Object.keys(sv);
      for (const a of ks) {
        nrm[a] = (nrm[a] || 0) + sv[a] * sv[a];
        for (const b of ks) if (a !== b) { (dot[a] ||= {})[b] = (dot[a][b] || 0) + sv[a] * sv[b]; }
      }
    }
    const adj = {};
    for (const a of this.aesthetics) {
      const row = dot[a] || {};
      adj[a] = Object.keys(row).map(b => [b, row[b] / Math.sqrt((nrm[a] || 1) * (nrm[b] || 1))]).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]);
    }
    return adj;
  }

  createProfile(now) { return createProfile(now); }
  createSession(now) { return createSession(now); }

  /* ---------------------------------------------------------------- search */
  /** Ids of products matching every query token as a word prefix. Cached. */
  searchIds(query) {
    const toks = tokenize(query), key = toks.join(' ');
    if (!key) return new Set();
    if (this._searchCache.has(key)) return this._searchCache.get(key);
    const out = new Set();
    for (const p of this.items) {
      const set = this.tokens.get(p.id);
      if (toks.every(t => { for (const w of set) if (w.startsWith(t)) return true; return false; })) out.add(p.id);
    }
    this._searchCache.set(key, out);
    return out;
  }

  /** Queries searched 2+ times in the last 7 days with no click / save / like. Feed these to Shop Scout as gaps. */
  unmetDemand(profile, now = Date.now()) {
    return Object.entries(profile.searches)
      .filter(([, s]) => !s.engaged && s.count >= 2 && now - s.first <= 7 * DAY)
      .map(([query, s]) => ({ query, count: s.count, strength: readV(s, now, this.cfg.halfLife.search) }))
      .sort((a, b) => b.strength - a.strength);
  }

  /* --------------------------------------------------------------- learning */

  applyEvents(profile, events, session) {
    const sorted = events.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
    for (const ev of sorted) this.applyEvent(profile, ev, session);
    this.compact(profile, sorted.length ? (sorted[sorted.length - 1].ts || Date.now()) : Date.now());
    return profile;
  }

  /**
   * ev: { type, ts, productId?, dwellMs? (view), slot? ('exploit'|'adjacent'|'wildcard'),
   *       searchTerm? (set when the event came from search results),
   *       query? (search), aestheticId? (pin), scores? (onboard_quiz), brandId? (onboard_brand) }
   * Types: like skip save unsave unlike tryon shop_click view hide closet_add worn
   *        search pin_aesthetic onboard_quiz onboard_brand
   */
  applyEvent(profile, ev, session) {
    const now = ev.ts || Date.now();
    switch (ev.type) {
      case 'search': this._search(profile, ev, session, now); break;
      case 'pin_aesthetic': this._addAes(profile, session, ev.aestheticId, this.cfg.events.pin, now); profile.evidence += this.cfg.events.pin; break;
      case 'onboard_quiz': this._quiz(profile, ev, session, now); break;
      case 'onboard_brand': addC(profile.brand, ev.brandId, 0, this.cfg.events.onboardBrand, now, this.cfg.halfLife.brand); profile.evidence += 2; break;
      default: this._productEvent(profile, ev, session, now);
    }
    if (session) session.events++;
    profile.updatedAt = now;
    return profile;
  }

  _addAes(profile, session, a, d, now) {
    if (!a || !d) return;
    addV(profile.aes, a, d, now, this.cfg.halfLife.aes);
    if (session) addV(session.aes, a, d, now, this.cfg.halfLife.session);
  }

  _quiz(profile, ev, session, now) {
    profile.quiz = { ...ev.scores };
    for (const [a, pct] of Object.entries(ev.scores || {})) this._addAes(profile, session, a, (pct / 100) * this.cfg.events.quizSeed, now);
    profile.evidence += 4;
  }

  _impression(profile, p, now) {
    const hl = this.cfg.halfLife;
    addC(profile.brand, p.brand, 1, 0, now, hl.brand);
    addC(profile.type, p.type, 1, 0, now, hl.type);
    addC(profile.color, p.color, 1, 0, now, hl.color);
    const g = readC(profile.global, now, hl.brand);
    profile.global = { shown: g.shown + 1, pos: g.pos, t: now };
    const m = this.vec.get(p.id).main;
    profile.expo[m] = (profile.expo[m] || 0) + 1;
  }

  _productEvent(profile, ev, session, now) {
    const p = this.byId.get(ev.productId);
    if (!p) return;
    const cfg = this.cfg, hl = cfg.halfLife, vec = this.vec.get(p.id);
    const rev = cfg.reverse[ev.type];
    const baseType = rev || ev.type;
    const spec = cfg.events[baseType];
    if (ev.type !== 'skip' && !spec) return;

    let touch = profile.touches[p.id];
    if (!touch) { touch = profile.touches[p.id] = { n: 0, d: {}, t: now }; this._impression(profile, p, now); }
    touch.t = now;

    /* ---- skip: ambiguous, so it only gently penalises strongly-tagged aesthetics ---- */
    if (ev.type === 'skip') {
      const k = cfg.skip;
      for (const a of Object.keys(vec.raw)) {
        if (vec.raw[a] >= k.minRawWeight) this._addAes(profile, session, a, -k.aesFactor * cfg.events.like.aes * vec.w[a], now);
      }
      if (session) {
        session.run = session.lastMain === vec.main ? session.run + 1 : 1;
        session.lastMain = vec.main;
        if (session.run >= k.runLength) { addV(session.aes, vec.main, -k.runPenalty, now, hl.session); session.run = 0; }
      }
      return;
    }
    if (session) { session.run = 0; session.lastMain = null; }

    /* ---- strength: reversal, dwell scaling, daily cap, diminishing returns ---- */
    let sign = 1, mult = 1;
    if (rev) { sign = -1; touch.n = Math.max(0, touch.n - 1); }
    else {
      if (baseType === 'view') { mult = clamp(((ev.dwellMs || 0) - 2000) / 3000, 0, 1); if (!mult) return; }
      const day = Math.floor(now / DAY);
      if (touch.d[baseType] === day) return;           // one counted event per type per item per day
      mult *= 1 / (1 + Math.log(touch.n + 1));          // diminishing returns on repeats
      touch.d[baseType] = day; touch.n++;
    }

    const aesStrength = sign * spec.aes * mult;
    for (const a of Object.keys(vec.w)) this._addAes(profile, session, a, aesStrength * vec.w[a], now);

    const unit = sign * (spec.attr / 2) * mult;          // 1 unit == one plain like
    addC(profile.brand, p.brand, 0, unit, now, hl.brand);
    addC(profile.type, p.type, 0, unit, now, hl.type);
    addC(profile.color, p.color, 0, unit, now, hl.color);
    const g = readC(profile.global, now, hl.brand);
    profile.global = { shown: g.shown, pos: Math.max(0, g.pos + unit), t: now };

    profile.evidence = Math.max(0, profile.evidence + sign * Math.abs(aesStrength));   // hides add evidence; unlike/unsave remove it

    if (aesStrength > 0) {
      if (hasPrice(p)) {
        profile.prices.push({ lp: Math.log(p.price), w: aesStrength, t: now });
        if (profile.prices.length > cfg.limits.prices) profile.prices.shift();
      }
      // Engaging with an exploration slot teaches the model that this neighbourhood is worth more of.
      if (ev.slot === 'adjacent' || ev.slot === 'wildcard') {
        const nb = this.adj[vec.main] || [];
        for (const a of nb) this._addAes(profile, session, a, (cfg.explore.bump * aesStrength) / nb.length, now);
      }
      // Search keys are stored normalised, so match the term the same way
      const term = ev.searchTerm && tokenize(ev.searchTerm).join(' ');
      if (term && profile.searches[term]) profile.searches[term].engaged = true;
    }
    if (baseType === 'hide' && !profile.hidden.includes(p.id)) profile.hidden.push(p.id);
  }

  _search(profile, ev, session, now) {
    const cfg = this.cfg, spec = cfg.events.search, q = tokenize(ev.query).join(' ');
    if (!q) return;
    let s = profile.searches[q];
    if (!s || now - s.last > spec.repeatWindow) s = profile.searches[q] = { v: 0, t: now, count: 0, first: now, last: now, engaged: false };
    const mult = s.count > 0 ? spec.repeatMult : 1;       // repeating a search within 7 days doubles it

    const ids = [...this.searchIds(q)].slice(0, 40);
    if (ids.length) {
      const acc = {};
      for (const id of ids) { const w = this.vec.get(id).w; for (const a of Object.keys(w)) acc[a] = (acc[a] || 0) + w[a] / ids.length; }
      for (const a of Object.keys(acc)) this._addAes(profile, session, a, spec.aes * mult * acc[a], now);
    }
    const padded = ' ' + q + ' ';
    for (const v of this.vocab) {
      if (v.phrase && padded.includes(' ' + v.phrase + ' ')) addC(profile[v.kind], v.id, 0, (spec.attr / 2) * mult, now, cfg.halfLife[v.kind]);
    }
    s.v = readV(s, now, cfg.halfLife.search) + mult; s.t = now; s.last = now; s.count++;
    profile.evidence += spec.aes * mult;
  }

  /** Trim the profile so the Firestore doc stays small. Called by applyEvents. */
  compact(profile, now = Date.now()) {
    const hl = this.cfg.halfLife, L = this.cfg.limits;
    for (const a of Object.keys(profile.aes)) if (Math.abs(readV(profile.aes[a], now, hl.aes)) < 0.05) delete profile.aes[a];
    for (const kind of ['brand', 'type', 'color']) {
      for (const k of Object.keys(profile[kind])) { const r = readC(profile[kind][k], now, hl[kind]); if (r.shown < 0.2 && r.pos < 0.1) delete profile[kind][k]; }
    }
    for (const q of Object.keys(profile.searches)) if (now - profile.searches[q].last > L.searchMaxAge) delete profile.searches[q];
    const tk = Object.keys(profile.touches);
    if (tk.length > L.touches) tk.sort((a, b) => profile.touches[b].t - profile.touches[a].t).slice(L.touches).forEach(k => delete profile.touches[k]);
    if (profile.hidden.length > L.hidden) profile.hidden = profile.hidden.slice(-L.hidden);
    return profile;
  }

  /* ---------------------------------------------------------------- scoring */

  /** Signed, bounded aesthetic affinity map (-1..1), blending long-term and session layers. */
  aestheticAffinity(profile, session, now = Date.now()) {
    const hl = this.cfg.halfLife, b = this.cfg.sessionBlend;
    const long = {}, vals = [];
    for (const a of Object.keys(profile.aes)) { const v = readV(profile.aes[a], now, hl.aes); long[a] = v; if (v) vals.push(Math.abs(v)); }
    vals.sort((x, y) => x - y);
    const p90 = vals.length ? vals[Math.floor(0.9 * (vals.length - 1))] : 0;
    const scale = Math.max(this.cfg.aesScaleFloor, p90);           // squash, don't max-normalise: one outlier can't flatten the rest
    const s = session ? b.start + (b.end - b.start) * Math.min(1, session.events / b.eventsToEnd) : 0;
    const sess = {};
    if (session) for (const a of Object.keys(session.aes)) sess[a] = readV(session.aes[a], now, hl.session);
    const aff = {};
    for (const a of new Set([...Object.keys(long), ...Object.keys(sess)])) aff[a] = Math.tanh(((1 - s) * (long[a] || 0) + s * (sess[a] || 0)) / scale);
    return aff;
  }

  /** Evidence-based weight on the prior (quiz + popularity). 0.6 when new, 0.05 once established. */
  priorWeight(profile) {
    const c = this.cfg.confidence, e = profile.evidence;
    const t = clamp((e - c.low) / (c.high - c.low), 0, 1);
    return c.priorWeightLow + (c.priorWeightHigh - c.priorWeightLow) * t;
  }

  _priceStats(profile, now) {
    if (profile.prices.length < 3) return null;
    let sw = 0, m = 0;
    const ws = profile.prices.map(x => x.w * decayF(now - x.t, 45 * DAY));
    profile.prices.forEach((x, i) => { sw += ws[i]; m += ws[i] * x.lp; });
    if (sw <= 0) return null;
    m /= sw;
    let v = 0; profile.prices.forEach((x, i) => { v += ws[i] * (x.lp - m) * (x.lp - m); });
    return { m, sd: Math.max(0.25, Math.sqrt(v / sw)) };
  }

  _closetCtx(closet) {
    const ctx = { ids: new Set(), typeColor: new Set(), compTypes: new Set(), compIds: new Set(), gaps: {}, gapMax: 0 };
    if (!closet) return ctx;
    for (const it of closet.items || []) {
      ctx.ids.add(it.id); ctx.typeColor.add(it.type + '|' + it.color);
      const oc = it.outfitCompanions || (this.byId.get(it.id) || {}).outfitCompanions;
      if (oc) { (oc.types || []).forEach(t => ctx.compTypes.add(t)); (oc.ids || []).forEach(i => ctx.compIds.add(i)); }
    }
    ctx.gaps = closet.gaps || {};
    ctx.gapMax = Math.max(0, ...Object.values(ctx.gaps));
    return ctx;
  }

  /**
   * Score every candidate. Returns entries sorted by `score` desc with a `parts` breakdown (for "why this").
   */
  scoreAll(profile, session, { closet, recentUnacted, exclude, now = Date.now(), rng = Math.random } = {}) {
    const cfg = this.cfg, W = cfg.weights, hl = cfg.halfLife, rate = cfg.rate;
    const aff = this.aestheticAffinity(profile, session, now);
    let affNorm = 0; for (const a in aff) affNorm += aff[a] * aff[a]; affNorm = Math.sqrt(affNorm);
    const g = readC(profile.global, now, hl.brand), p0 = (g.pos + 1) / (g.shown + 4);
    const ra = (counter, h) => { const r = readC(counter, now, h); return Math.tanh(((r.pos + rate.priorStrength * p0) / (r.shown + rate.priorStrength) - p0) * rate.scale); };
    const ps = this._priceStats(profile, now);
    const cc = this._closetCtx(closet);
    const pw = this.priorWeight(profile);
    const hidden = new Set(profile.hidden);
    const terms = Object.entries(profile.searches).map(([q, s]) => ({ ids: this.searchIds(q), v: readV(s, now, hl.search) })).filter(t => t.v > 0.05 && t.ids.size);
    const quiz = profile.quiz; let quizNorm = 0; if (quiz) for (const a in quiz) quizNorm += quiz[a] * quiz[a]; quizNorm = Math.sqrt(quizNorm);
    const pc = cfg.confidence.prior;
    const cacheT = {}, cacheB = {}, cacheC = {};

    const out = [];
    for (const p of this.items) {
      if ((exclude && exclude.has(p.id)) || hidden.has(p.id)) continue;
      const vec = this.vec.get(p.id);

      let dot = 0; for (const a in vec.sv) if (aff[a]) dot += aff[a] * vec.sv[a];
      const cos = affNorm ? dot / affNorm : 0;

      const ta = (cacheT[p.type] ??= ra(profile.type[p.type], hl.type));
      const ba = (cacheB[p.brand] ??= ra(profile.brand[p.brand], hl.brand));
      const ca = (cacheC[p.color] ??= ra(profile.color[p.color], hl.color));
      const pf = ps && hasPrice(p) ? Math.exp(-0.5 * Math.pow((Math.log(p.price) - ps.m) / (1.5 * ps.sd), 2)) : 0.5;

      const gap = cc.gapMax ? clamp((cc.gaps[p.type] || 0) / cc.gapMax, 0, 1) : 0;
      const comp = cc.compIds.has(p.id) ? 1 : cc.compTypes.has(p.type) ? 0.5 : 0;
      const cf = cfg.closetMix.gap * gap + cfg.closetMix.companion * comp;

      let sb = 0; for (const t of terms) if (t.ids.has(p.id)) sb += t.v; sb = Math.tanh(sb / 2);

      const ex = cfg.explore.c / Math.sqrt(1 + (profile.expo[vec.main] || 0));

      const learned = W.aesthetic * cos + W.type * ta + W.brand * ba + W.color * ca + W.price * pf + W.closet * cf + W.search * sb;

      let qcos = 0;
      if (quizNorm) { let d = 0; for (const a in vec.sv) if (quiz[a]) d += quiz[a] * vec.sv[a]; qcos = d / quizNorm; }
      const prior = pc.quiz * qcos + pc.popularity * ((p.popularity ?? 0.5) - 0.5) * 2;

      let pen = 0;
      if (cc.typeColor.has(p.type + '|' + p.color)) pen += cfg.penalties.nearDuplicate;
      if (recentUnacted && recentUnacted.has(p.id)) pen += cfg.penalties.recentUnacted;

      const score = (1 - pw) * learned + pw * prior + W.explore * ex - pen + cfg.jitter * rng();
      out.push({ product: p, score, cos, parts: { cos, type: ta, brand: ba, color: ca, price: pf, closet: cf, search: sb, explore: ex, prior, priorWeight: pw, penalty: pen } });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /* --------------------------------------------------------------- the feed */

  /**
   * Build one batch.
   * @returns {{product, score, slot:'exploit'|'adjacent'|'wildcard', parts}[]}
   */
  rankFeed({ profile, session, closet, recentUnacted, exclude, count = 10, now = Date.now(), rng = Math.random }) {
    const cfg = this.cfg;
    let scored = this.scoreAll(profile, session, { closet, recentUnacted, exclude, now, rng });

    // Hard-exclude strong mismatches once there is enough evidence to trust the profile.
    if (profile.evidence >= cfg.penalties.hardExcludeMinEvidence) {
      const kept = scored.filter(x => x.cos >= cfg.penalties.hardExcludeCos);
      if (kept.length >= count * 3) scored = kept;
    }

    const aff = this.aestheticAffinity(profile, session, now);
    const m = Math.round(count * (cfg.explore.adjacentShare + cfg.explore.wildcardShare));
    const adjN = Math.round((m * cfg.explore.adjacentShare) / (cfg.explore.adjacentShare + cfg.explore.wildcardShare || 1));

    const exploit = this._mmr(scored, Math.max(0, count - m));
    const taken = new Set(exploit.map(x => x.product.id));
    const pick = pool => { const a = pool.filter(x => !taken.has(x.product.id)); if (!a.length) return null; const x = a[Math.floor(rng() * a.length)]; taken.add(x.product.id); return x; };

    const explore = [];
    const canAdj = adjN > 0 && profile.evidence >= cfg.explore.minEventsForAdjacent;
    if (canAdj) {
      const tops = Object.keys(aff).sort((a, b) => aff[b] - aff[a]).slice(0, 2);
      const set = new Set();
      tops.forEach(a => (this.adj[a] || []).forEach(b => { if (!tops.includes(b)) set.add(b); }));
      for (let i = 0; i < adjN; i++) { const x = pick(scored.filter(s => set.has(this.vec.get(s.product.id).main))); if (x) explore.push({ ...x, slot: 'adjacent' }); }
    }
    while (explore.length < m) {
      const pool = scored.filter(s => !taken.has(s.product.id));
      if (!pool.length) break;
      const expo = s => profile.expo[this.vec.get(s.product.id).main] || 0;
      const minE = Math.min(...pool.map(expo));
      const wild = pool.filter(s => expo(s) <= minE + 1 && (aff[this.vec.get(s.product.id).main] || 0) < 0.3);
      const x = pick(wild.length ? wild : pool);
      if (!x) break;
      explore.push({ ...x, slot: 'wildcard' });
    }

    const out = exploit.map(x => ({ ...x, slot: 'exploit' }));
    for (const x of explore) out.splice(Math.floor(rng() * (out.length + 1)), 0, x);
    return out.slice(0, count);
  }

  _sim(a, b) {
    const m = cfgMmr(this.cfg);
    const va = this.vec.get(a.id).sv, vb = this.vec.get(b.id).sv;
    let d = 0; for (const k in va) if (vb[k]) d += va[k] * vb[k];
    return m.simStyle * d + m.simBrand * (a.brand === b.brand) + m.simType * (a.type === b.type);
  }

  /** Maximal marginal relevance: score minus lambda * similarity to the closest item already picked. */
  _mmr(scored, count) {
    const { lambda, poolSize } = this.cfg.mmr;
    const pool = scored.slice(0, poolSize), chosen = [];
    while (chosen.length < count && pool.length) {
      let best = 0, bv = -Infinity;
      for (let j = 0; j < pool.length; j++) {
        let mx = 0; for (const c of chosen) { const s = this._sim(pool[j].product, c.product); if (s > mx) mx = s; }
        const v = pool[j].score - lambda * mx;
        if (v > bv) { bv = v; best = j; }
      }
      chosen.push(pool.splice(best, 1)[0]);
    }
    return chosen;
  }
}

/* -------------------------------------------------------- outcome logging */

/**
 * Log what happened to every served item so weights can be tuned on evidence.
 * Persist `summary()` per batch (or the raw rows) to Firestore / analytics.
 */
export function createBatchLog() {
  const rows = [];
  return {
    served(entry, ts = Date.now()) { rows.push({ id: entry.product.id, slot: entry.slot, ts, outcome: 'skip' }); },
    outcome(productId, outcome) { const r = rows.find(x => x.id === productId); if (r && (outcome !== 'skip' || r.outcome === 'skip')) r.outcome = outcome; },
    summary() {
      const n = rows.length || 1;
      const liked = rows.filter(r => r.outcome === 'like' || r.outcome === 'save');
      const ex = rows.filter(r => r.slot !== 'exploit');
      const first = rows.findIndex(r => r.outcome === 'like' || r.outcome === 'save');
      return {
        shown: rows.length,
        likeRate: liked.length / n,
        saveRate: rows.filter(r => r.outcome === 'save').length / n,
        itemsToFirstLike: first < 0 ? null : first + 1,
        exploreLikeRate: ex.length ? ex.filter(r => r.outcome === 'like' || r.outcome === 'save').length / ex.length : null
      };
    },
    rows
  };
}

/* ----------------------------------------------------------------- utils */

function cfgMmr(cfg) { return cfg.mmr; }
function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(over)) out[k] = (base && typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof over[k] === 'object') ? deepMerge(base[k], over[k]) : over[k];
  return out;
}
