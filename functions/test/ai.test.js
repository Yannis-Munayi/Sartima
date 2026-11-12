// generateJson: provider choice, the Gemini model fallback chain, and JSON parsing.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const anthropicCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: function Anthropic() { return { messages: { create: anthropicCreate } } } }))

const { generateJson, aiProvider } = await import('../ai.js')

const gemini = (text, status = 200) => ({
  ok: status === 200, status,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  text: async () => `status ${status}`,
})
const opts = { prompt: 'Return JSON', maxTokens: 100, budgetMs: 60_000 }
const modelOf = (url) => url.split('/models/')[1].split(':')[0]

beforeEach(() => {
  anthropicCreate.mockReset()
  delete process.env.AI_PROVIDER
  process.env.GEMINI_API_KEY = 'g-key'
  process.env.ANTHROPIC_API_KEY = 'a-key'
})

describe('aiProvider', () => {
  it('uses Gemini when its key is set, Claude otherwise, or whatever AI_PROVIDER says', () => {
    expect(aiProvider()).toBe('gemini')
    delete process.env.GEMINI_API_KEY
    expect(aiProvider()).toBe('anthropic')
    process.env.AI_PROVIDER = 'gemini'
    expect(aiProvider()).toBe('gemini')
    process.env.GEMINI_API_KEY = 'g'
    process.env.AI_PROVIDER = 'anthropic'
    expect(aiProvider()).toBe('anthropic')
    process.env.AI_PROVIDER = 'openai' // unknown → default rule
    expect(aiProvider()).toBe('gemini')
  })
})

describe('Gemini', () => {
  it('returns parsed JSON from the first model that answers', async () => {
    const fetchMock = vi.fn(async () => gemini('{"ok": true}'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await generateJson(opts)).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(init.headers['x-goog-api-key']).toBe('g-key')
    const body = JSON.parse(init.body)
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json', maxOutputTokens: 2148 })
    expect(modelOf(url)).toBeTruthy()
  })

  it('falls through to the next model on "high demand" and rate limits', async () => {
    const seen = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      seen.push(modelOf(url))
      return seen.length === 1 ? gemini('', 503) : seen.length === 2 ? gemini('', 429) : gemini('{"n": 3}')
    }))
    expect(await generateJson(opts)).toEqual({ n: 3 })
    expect(new Set(seen).size).toBe(3)
  })

  it('tries the next model when one returns no text', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }) })
      .mockResolvedValueOnce(gemini('{"second": true}'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await generateJson(opts)).toEqual({ second: true })
  })

  it('stops at a request error (400) instead of trying other models', async () => {
    const fetchMock = vi.fn(async () => gemini('', 400))
    vi.stubGlobal('fetch', fetchMock)
    await expect(generateJson(opts)).rejects.toMatchObject({ code: 'unavailable' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reports "unavailable" when every model fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    await expect(generateJson(opts)).rejects.toMatchObject({ code: 'unavailable', message: 'AI is temporarily unavailable' })
  })

  it("doesn't start another attempt with under 3 seconds of budget left", async () => {
    const fetchMock = vi.fn(async () => gemini('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(generateJson({ ...opts, budgetMs: 2000 })).rejects.toMatchObject({ code: 'unavailable' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends images inline and passes the schema through', async () => {
    const fetchMock = vi.fn(async () => gemini('{"items": []}'))
    vi.stubGlobal('fetch', fetchMock)
    const schema = { type: 'object' }
    await generateJson({ ...opts, image: { base64: 'QUJD', mimeType: 'image/png' }, schema })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/png', data: 'QUJD' } })
    expect(body.generationConfig.responseJsonSchema).toEqual(schema)
  })
})

describe('JSON parsing', () => {
  it('pulls the JSON object out of surrounding prose or code fences', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemini('Here you go:\n```json\n{"a": [1, 2]}\n```')))
    expect(await generateJson(opts)).toEqual({ a: [1, 2] })
  })

  it('reports malformed replies as "internal"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemini('no json here')))
    await expect(generateJson(opts)).rejects.toMatchObject({ code: 'internal' })
    vi.stubGlobal('fetch', vi.fn(async () => gemini('{"broken": }')))
    await expect(generateJson(opts)).rejects.toMatchObject({ code: 'internal' })
  })
})

describe('Claude', () => {
  beforeEach(() => { process.env.AI_PROVIDER = 'anthropic' })

  it('uses Haiku and returns parsed JSON', async () => {
    anthropicCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '{"pick": "a"}' }] })
    expect(await generateJson(opts)).toEqual({ pick: 'a' })
    expect(anthropicCreate.mock.calls[0][0]).toMatchObject({ model: expect.stringMatching(/^claude-haiku/), max_tokens: 100 })
  })

  it('sends images as base64 blocks', async () => {
    anthropicCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '{}' }] })
    await generateJson({ ...opts, image: { base64: 'QUJD', mimeType: 'image/jpeg' } })
    const content = anthropicCreate.mock.calls[0][0].messages[0].content
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } })
  })

  it('reports provider errors as "unavailable"', async () => {
    anthropicCreate.mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 529 }))
    await expect(generateJson(opts)).rejects.toMatchObject({ code: 'unavailable' })
  })
})
