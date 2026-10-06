# Cloudflare + GitHub deployment

Use Cloudflare Workers Static Assets, D1, and a one-minute Cron Trigger. GitHub Actions validates main and deploys it with Wrangler. This keeps the frontend, API and reminder scheduler in one Worker, with no separate hosting account, map key or notification vendor.

## One-time setup

```sh
git clone --branch main https://github.com/musaddique333/viewing-tracker.git
cd viewing-tracker
npm ci
npm run setup
npm run keys
npx wrangler secret bulk .dev.vars
npm run deploy
```

`npm run setup` opens Cloudflare login, creates `viewing-tracker-db`, writes its returned ID to `wrangler.jsonc`, and asks before applying remote migrations. If a database with that name already exists, find its ID in Cloudflare → Storage & databases → D1, put it in `wrangler.jsonc`, then rerun setup. No remote database is created by CI.

The Worker URL is printed by deploy, normally on your account's `workers.dev` subdomain. Do not guess the URL. The production secrets are `PASSWORD_HASH`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`; `.dev.vars` is generated locally and must never enter GitHub. VAPID public keys are intentionally public; private keys and password hashes remain secret. Keep keys stable or enrolled browsers must resubscribe.

If you already have `.dev.vars` for local testing, remove or move it privately before generating production credentials. Never deploy local test credentials.

Before production rollout, validate the login, add/edit/delete flow, calendar, agenda, map, phone layouts, install prompt and actual Android test push. The authoring environment could not complete browser visual QA.

## GitHub account steps

1. Repository → **Settings → Branches / Default branch** (or General) → choose **main**. The original empty repo default was `musaddique`; the GitHub connector could create `main` but cannot change this repository setting.
2. Cloudflare → My Profile → API Tokens → create a narrowly scoped token for this account with **Workers Scripts: Edit** and the account read permissions required by Wrangler (Workers Routes: Edit only for a custom route). D1 provisioning/migrations are performed separately through your local Cloudflare login.
3. Repository → **Settings → Secrets and variables → Actions → Secrets**:
   - `CLOUDFLARE_API_TOKEN` — your deployment token.
   - `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID.
4. Under **Variables**, add:
   - `D1_DATABASE_ID` — the real D1 ID produced by setup.
   - `CLOUDFLARE_DEPLOY_ENABLED` — `true`, only after setup and production secrets are ready.
5. Push to `main`, or **Actions → CI → Run workflow** on `main`.

The validate job runs on every main push and pull request. Deployment is skipped until explicitly enabled. Once enabled it requires successful validation. No database migration is applied automatically on deployment. Configure the `production` GitHub environment with any desired approvals. Avoid enabling a second Cloudflare Git build pipeline for the same Worker.

## Migrations and recovery

Local: `npm run db:local`.

Before a production migration, make a private backup:

```sh
npx wrangler d1 export viewing-tracker-db --remote --output /path/outside/repo/viewing-backup.sql
npm run db:remote
```

Review migrations before applying them. Current migrations create the schema and add a reminder version; they do not drop user data. Apply new additive migrations before deploying code that uses them. D1 Time Travel is another recovery option; check your account's retention and restore UI.

For a code rollback, revert the bad commit and push to main. Keep schema changes backward-compatible; restoring an entire DB can erase newer viewings, subscriptions and sessions. Back up current state before a restore. A deliberate restore can use `wrangler d1 execute` with a reviewed SQL file or D1 Time Travel after assessing newer data loss. Never commit backups.

## Verify production

- Sign in; save and edit a viewing; refresh and confirm persistence.
- Ensure `/api/viewings` returns 401 in a signed-out session.
- Install in Android Chrome; enable notifications and send the test push.
- Create a test viewing a few minutes away. Its six-hour reminder is already due and should be picked up by the next cron tick. Confirm receipt, then delete the test entry.
- Cloudflare → Worker → Settings → Trigger Events: confirm `* * * * *`. New/changed cron triggers may need propagation time.
- Check Workers logs for errors. No addresses/passwords are deliberately logged by application code.

Cron leases prevent ordinary duplicate sends and retry transient push failures. There is an unavoidable crash window after a push provider accepts a message but before its receipt is recorded; the stable notification tag helps replace duplicate visible notifications. The scheduler is scoped for personal usage (up to 100 due viewings each minute).

## Password changes

Generate a new salted PBKDF2 hash locally, then update only `PASSWORD_HASH` using `wrangler secret put PASSWORD_HASH`. Revoke existing sessions with:

```sh
npx wrangler d1 execute viewing-tracker-db --remote --command "DELETE FROM sessions"
```

Changing the password alone does not revoke existing sessions. Keep VAPID keys unchanged unless deliberately rotating all device subscriptions.

## Attendance and property progress update

Pull main, apply additive migration 0003 before deploying, then deploy:

```sh
git pull origin main
npm run db:remote
npm run deploy
```

Calendar entries open a map and all viewing information. Mark your attendance plan, record attendance after the viewing ends, and track email, application, documents, references, offer, tenancy agreement, deposit and keys. Email and document checkboxes record actions performed elsewhere; the app does not send emails or upload documents. Mark the outcome as secured, unsuccessful or withdrawn. Declining attendance suppresses reminders. Existing records are preserved.
