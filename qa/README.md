# Sartima QA

Automated checks for every line of the Sartima test checklist, plus a local
dashboard that shows how the local copy and the live site (sartima.ca) are
doing.

Nothing in this folder is part of the app. Vite doesn't bundle it, Firebase
Hosting doesn't serve it, and the dashboard only listens on `127.0.0.1`.

## Start

```bash
npm run qa          # dashboard at http://127.0.0.1:4545
```

Pick the **Local** or **Live** tab and press **Run all**. Local starts
`npm run dev` for you, or a production build if you choose that in
"Test against". The checks that only work in a production build (offline app
shell, Sentry) build and serve one themselves when the rest of the run uses
the dev server, so they run either way. That build goes to
`qa/results/prod-build` and adds a minute or two to runs that include them.

From the terminal, without the dashboard:

```bash
npm run qa:local                 # whole checklist against localhost
npm run qa:live -- -g "Search"   # only matching tests, against sartima.ca
```

## Setup (`qa/.env`)

Copy `qa/.env.example` to `qa/.env`. Every setting is optional. A test whose
requirement is missing shows as **Needs setup** and says what it needs.

- **Free and Pro test accounts:** use dedicated accounts, never your own. Tests
  overwrite their closet, liked items, wishlist, boards and outfit log.
- **Throwaway accounts:** sign-up, onboarding, consent and delete-account tests
  create `@example.com` accounts and delete them when the test ends. This is on
  for Local and off for Live by default.
- **Stripe:** the billing tests only run with `QA_STRIPE_TEST_MODE=1`, while
  the deployed Functions use Stripe test keys.

## What the statuses mean

| Status | Meaning |
|---|---|
| Passing / Failing / Flaky | The test ran. Flaky means it passed on its retry (only the Live tab retries). |
| Needs setup | It's missing an account or a setting from `qa/.env`. |
| Manual check | It can't be automated, for example a push notification arriving, a real Stripe renewal failing, or a paid try-on. Mark it yourself in the inspector. |
| Known issue | A tag on a test that targets a bug already known. It still runs. |

Click any test to inspect it: the error, the code line, a screenshot, a video,
a trace (opens Playwright's trace viewer), and its last 20 results.

## Cost and side effects

- AI, weather, try-on, feedback and image-search Functions are **stubbed** by
  default, so there's no Gemini spend, no Replicate charges, no emails, and no
  drain on the shared Unsplash/Pexels quota or the per-IP guest photo limit.
- A few checks call real Functions on purpose, because the point is to check
  the backend:
  - `validateEmail`, and `searchImages` once directly in 16-backend (free).
  - `getWeather`, once per run.
  - One `anthropicOutfit` call a day at most, for the free-tier daily limit.
  - Up to 3 `anthropicTrip` calls a month, for the Pro monthly limit.
  - The over-limit checks, which the server refuses before any AI work.
- Scheduled re-runs only happen while `npm run qa` is running.

## Files

- `tests/`: one spec per checklist section (01–16).
- `lib/fixtures.js`: roles, account login and locking, data seeding, Function stubs, page helpers.
- `lib/firebase-rest.js`: seeds and reads test-account data through the REST APIs, under the same Firestore rules as the app.
- `server.js` and `dashboard/index.html`: the dashboard.
- `results/` (gitignored): reports, history, saved failure artifacts, and login state.
