# Viewing Tracker

A private accommodation-viewing calendar that installs on Android from Chrome.

## Features

- Month calendar, chronological agenda, and a map for each property.
- Add, edit and delete viewings; mark them scheduled, viewed or cancelled.
- Address, UK date/time, duration, optional agent/contact, property links and notes.
- Google Maps links and one-tap address copying.
- Six-hour server-triggered Web Push reminders, including while the app is closed.
- Per-device subscriptions, a test-notification button and persistent notification/vibration requests.
- Password sign-in, HTTP-only sessions, rate-limited login and server-side validation.
- Small vanilla JavaScript/Vite frontend and TypeScript Cloudflare Worker with D1. No framework or map API key is needed.

## Local setup

Requires Node.js 24 and npm.

```sh
npm ci
npm run keys
npm run db:local
npm run dev
```

Open the URL printed by Wrangler. `npm run keys` generates a password hash and VAPID keys into gitignored `.dev.vars`. Do not reuse example/test credentials or commit secrets. The password prompt is visible in your terminal; run it privately.

`npm run dev:ui` starts only the UI server. Use `npm run dev` for the complete app.

## Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact Cloudflare and GitHub setup. Production branch: **main**.

The repository can be public; the app's viewing records are protected by a password and stored in your D1 database. This is a single-owner application: all signed-in devices share the same calendar.

## Install and enable reminders

1. Open the deployed HTTPS URL in Android Chrome and sign in.
2. Chrome menu → **Add to Home screen → Install** (or use the in-app install button on desktop).
3. Tap **Enable reminders**, allow notifications, then send a **Test notification**.
4. Check Chrome/app notification settings and allow sound/vibration.

Cron checks every minute. A viewing added inside the six-hour window is picked up on the next run. Editing its time or reactivating a cancelled/viewed entry creates a new reminder version. Editing notes, address or agent details alone does not resend an already delivered alert. A cancelled, deleted or started viewing is excluded; a push already accepted by a provider cannot be recalled.

Notifications are best-effort: network, battery saving, browser restrictions, notification permission and Do Not Disturb can delay or silence them. The app requests high urgency, vibration and interaction-required notifications, but cannot force an alarm or sound. Reminders can show addresses on your lock screen; adjust your phone's preview settings if needed. Signing out does not disable an enrolled device's reminders; turn them off first in reminder settings if this is a shared device. Opening the app renews its push registration. If browser data is cleared or the subscription expires, re-enable reminders.

Viewing times always use **Europe/London**. Spring clock-change gaps are rejected; the duplicated autumn hour uses its first occurrence. Offline saving is not supported. Personal data is not cached by the service worker.

Maps load from Google when you open Locations; fonts load from Google Fonts. Addresses are sent to Google for the selected map/location link. There is no automated inbox import or geocoding database.

## Validation

```sh
npm run check
npx wrangler deploy --dry-run --outdir /tmp/viewing-worker-build
```

Tests cover input validation, unsafe links/push endpoints, UK daylight saving, authentication, CSRF, optimistic edit conflicts, CRUD, session logout, per-device reminder deduplication, retry leases, cancellations and rescheduling. API tests use real SQLite behind a D1 statement adapter; reminder transport is mocked. They do not replace a production push test on your phone.

## Layout

- `src/` — responsive calendar, agenda, location map, dialogs and UK date utilities.
- `worker/` — authenticated API and scheduled Web Push delivery.
- `migrations/` — additive D1 schema changes.
- `public/` — install manifest, notification service worker, icons and security headers.
- `tests/` — domain, API, DST and reminder tests.
- `.github/workflows/ci.yml` — validation, build, Worker dry run and gated production deploy.

## Current delivery status

Source and deployment workflow are implemented. Cloudflare account credentials/resources must be configured before a production URL or real device push can be verified. Browser visual QA was blocked in the authoring environment (no browser executable); verify the UI at phone and desktop widths before the first production deployment. No real viewings or login secrets are included.
