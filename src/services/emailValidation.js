import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { logWarn } from './logger'

const validateEmailFn = httpsCallable(functions, 'validateEmail')

const MESSAGES = {
  syntax:        "That doesn't look like a valid email address.",
  disposable:    "Temporary or throwaway inboxes can't be used. Please use an email you'll keep.",
  undeliverable: "This address can't receive email. Check it for typos.",
}

/**
 * Pre-signup check via the validateEmail function: syntax, throwaway domains,
 * a real mail server, and typos of big providers. Resolves:
 *   { error, suggestion }
 *   error      — copy to show; the address must not be used (null if fine)
 *   suggestion — full corrected address to offer, e.g. "you@gmail.com"
 * Fails open: if the check itself can't run (offline, cold start, DNS outage)
 * both are null and signup carries on — the verification email sent after
 * signup is the backstop.
 */
export async function validateSignupEmail(email) {
  try {
    const { data } = await validateEmailFn({ email })
    return {
      error:      data.valid ? null : (MESSAGES[data.reason] ?? MESSAGES.undeliverable),
      suggestion: data.suggestion ?? null,
    }
  } catch (err) {
    logWarn('emailValidation', 'validateEmail unavailable — allowing signup', { code: err?.code })
    return { error: null, suggestion: null }
  }
}
