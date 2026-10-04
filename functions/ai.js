// Provider-agnostic JSON generation for the AI-backed functions (vision,
// outfit, gap reasoning, trip). The callable names still say "anthropic" so
// clients don't need to change — the provider behind them is picked here.
//
// AI_PROVIDER=gemini|anthropic selects explicitly; otherwise Gemini is used
// whenever GEMINI_API_KEY is set (free tier), falling back to Claude.

import Anthropic from '@anthropic-ai/sdk'
import { HttpsError } from 'firebase-functions/v2/https'

const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001'

// Tried in order. The free tier often answers 503 "high demand" or 429 for a
// single model, and quotas are per model, so falling through keeps requests
// working. Flash-Lite sits before 2.5 Flash because its bounding boxes are
// noticeably better with thinking turned down.
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']
const GEMINI_RETRYABLE = new Set([429, 500, 502, 503, 504])
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

let _anthropic = null
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

export function aiProvider() {
  const explicit = process.env.AI_PROVIDER
  if (explicit === 'gemini' || explicit === 'anthropic') return explicit
  return process.env.GEMINI_API_KEY ? 'gemini' : 'anthropic'
}

async function callClaude({ prompt, image, maxTokens }) {
  const content = image
    ? [
        { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
        { type: 'text', text: prompt },
      ]
    : prompt
  const response = await getAnthropic().messages.create({
    model:      CLAUDE_HAIKU,
    max_tokens: maxTokens,
    messages:   [{ role: 'user', content }],
  })
  return response.content[0]?.text ?? ''
}

// Thinking tokens count against maxOutputTokens, so keep thinking low and
// leave headroom on top of the visible answer's budget.
function geminiThinking(model) {
  return model.startsWith('gemini-2.5') ? { thinkingBudget: 0 } : { thinkingLevel: 'low' }
}

async function callGemini({ prompt, image, maxTokens, schema, budgetMs }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const parts = image
    ? [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: prompt }]
    : [{ text: prompt }]
  const deadline = Date.now() + budgetMs
  let lastError = null

  for (const model of GEMINI_MODELS) {
    const remaining = deadline - Date.now()
    if (remaining < 3000) break
    try {
      const res = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
        method:  'POST',
        headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
        signal:  AbortSignal.timeout(remaining),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            ...(schema && { responseJsonSchema: schema }),
            maxOutputTokens: maxTokens + 2048,
            thinkingConfig:  geminiThinking(model),
          },
        }),
      })
      if (res.ok) {
        const body = await res.json()
        const candidate = body.candidates?.[0]
        const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
        if (text) return text
        lastError = new Error(`${model} returned no text (${candidate?.finishReason ?? body.promptFeedback?.blockReason ?? 'unknown'})`)
      } else {
        const detail = await res.text().catch(() => '')
        lastError = new Error(`${model} HTTP ${res.status}: ${detail.slice(0, 300)}`)
        // A 400/403 means the request itself is wrong — another model won't help
        if (!GEMINI_RETRYABLE.has(res.status)) break
      }
    } catch (err) {
      lastError = err // network error or timeout
    }
    console.warn('Gemini attempt failed, trying next model:', lastError.message)
  }
  throw lastError ?? new Error('Gemini request timed out')
}

/**
 * Run a prompt (optionally with one image) and return the parsed JSON reply.
 * Provider failures surface as HttpsError('unavailable'); unparseable replies
 * as HttpsError('internal').
 *
 * @param {object}  opts
 * @param {string}  opts.prompt
 * @param {{ base64: string, mimeType: string }} [opts.image]
 * @param {number}  opts.maxTokens  — budget for the visible answer
 * @param {object}  [opts.schema]   — JSON Schema; enforced by Gemini, described in the prompt for Claude
 * @param {number}  opts.budgetMs   — total time allowed across retries; keep under the function timeout
 */
export async function generateJson(opts) {
  const provider = aiProvider()
  let text
  try {
    text = provider === 'gemini' ? await callGemini(opts) : await callClaude(opts)
  } catch (err) {
    console.error(`AI request failed (${provider}):`, err.status ?? '', err.message)
    throw new HttpsError('unavailable', 'AI is temporarily unavailable')
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new HttpsError('internal', 'Malformed AI response')
  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    throw new HttpsError('internal', 'Malformed AI response')
  }
}
