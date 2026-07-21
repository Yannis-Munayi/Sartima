// Shared across every spec: signed-out visitors now land on SignupFlow
// (see src/screens/signup/SignupFlow.jsx) instead of the guest-browsable
// app shell. Specs that exercise the rest of the app need to bypass it
// first via the "Continue as guest" escape hatch; specs that exercise the
// gate itself (e2e/auth.spec.js) drive it directly instead of using this.

export async function dismissConsentBanner(page) {
  const decline = page.getByRole('button', { name: 'Decline', exact: true })
  if (await decline.count()) {
    await decline.first().click({ force: true }).catch(() => {})
  }
}

export async function bypassSignupGate(page) {
  const guestLink = page.getByRole('button', { name: 'Continue as guest', exact: true })
  if (await guestLink.count()) {
    await guestLink.click({ force: true }).catch(() => {})
    await page.getByRole('button', { name: 'Continue as guest anyway', exact: true })
      .click({ force: true }).catch(() => {})
  }
}
