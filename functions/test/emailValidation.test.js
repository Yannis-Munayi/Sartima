// checkEmail with DNS replaced: syntax, throwaway domains, no-reply,
// reserved names, mail-server lookups and typo suggestions.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const resolveMx = vi.fn()
vi.mock('dns/promises', () => ({
  default: { Resolver: function Resolver() { return { resolveMx } } },
}))

const { checkEmail } = await import('../emailValidation.js')

const dnsError = (code) => Object.assign(new Error(code), { code })

beforeEach(() => {
  resolveMx.mockReset().mockResolvedValue([{ exchange: 'mx.mail.test', priority: 10 }])
})

describe('syntax', () => {
  it('rejects malformed addresses', async () => {
    for (const bad of ['', 'plain', '@gmail.com', 'a@', 'a@b', 'a..b@x.com', '.a@x.com', 'a.@x.com', 'a b@x.com', 'a@-x.com', 'a@x.c0m', `${'a'.repeat(65)}@x.com`]) {
      expect(await checkEmail(bad), bad).toEqual({ valid: false, reason: 'syntax' })
    }
  })

  it('accepts ordinary addresses, trimming whitespace', async () => {
    expect(await checkEmail('  first.last+tag@gmail.com ')).toEqual({ valid: true })
  })
})

describe('known providers', () => {
  it('skips DNS for big providers', async () => {
    expect(await checkEmail('me@outlook.com')).toEqual({ valid: true })
    expect(await checkEmail('me@Yahoo.CA')).toEqual({ valid: true })
    expect(resolveMx).not.toHaveBeenCalled()
  })
})

describe('rejections', () => {
  it('blocks throwaway inboxes, including subdomains', async () => {
    expect(await checkEmail('x@mailinator.com')).toMatchObject({ valid: false, reason: 'disposable' })
    expect(await checkEmail('x@inbox.mailinator.com')).toMatchObject({ valid: false, reason: 'disposable' })
  })

  it('blocks no-reply addresses and reserved domains', async () => {
    expect(await checkEmail('noreply@company.com')).toEqual({ valid: false, reason: 'undeliverable' })
    expect(await checkEmail('me@example.com')).toMatchObject({ valid: false, reason: 'undeliverable' })
    expect(await checkEmail('me@site.test')).toMatchObject({ valid: false, reason: 'undeliverable' })
  })

  it('blocks domains with no mail server, or a null MX', async () => {
    resolveMx.mockRejectedValueOnce(dnsError('ENOTFOUND'))
    expect(await checkEmail('me@nowhere-at-all.ca')).toMatchObject({ valid: false, reason: 'undeliverable' })
    resolveMx.mockRejectedValueOnce(dnsError('ENODATA'))
    expect(await checkEmail('me@no-mx.ca')).toMatchObject({ valid: false, reason: 'undeliverable' })
    resolveMx.mockResolvedValueOnce([{ exchange: '.', priority: 0 }])
    expect(await checkEmail('me@null-mx.ca')).toMatchObject({ valid: false, reason: 'undeliverable' })
  })

  it('throws on DNS outages instead of guessing', async () => {
    resolveMx.mockRejectedValueOnce(dnsError('ETIMEOUT'))
    await expect(checkEmail('me@slow-dns.ca')).rejects.toMatchObject({ code: 'ETIMEOUT' })
  })
})

describe('typo suggestions', () => {
  it('suggests the provider for one-letter typos and swaps', async () => {
    expect((await checkEmail('ana@gmial.com')).suggestion).toBe('ana@gmail.com')
    expect((await checkEmail('ana@gamil.com')).suggestion).toBe('ana@gmail.com')
    expect((await checkEmail('ana@hotmial.com')).suggestion).toBe('ana@hotmail.com')
  })

  it('allows two edits only on longer domains', async () => {
    // 10+ characters: two edits still count as a typo
    expect((await checkEmail('ana@googlemial.cm')).suggestion).toBe('ana@googlemail.com')
    expect((await checkEmail('ana@protnmal.com')).suggestion).toBe('ana@protonmail.com')
    // short domains get one edit of slack: "gmal.co" is two away from gmail.com
    expect((await checkEmail('ana@gmal.co')).suggestion).toBeUndefined()
  })

  it("doesn't 'fix' a real company domain or a regional variant of a provider", async () => {
    expect(await checkEmail('ana@acme-studio.ca')).toEqual({ valid: true, suggestion: undefined })
    expect(await checkEmail('ana@live.fr')).toEqual({ valid: true })
  })
})
