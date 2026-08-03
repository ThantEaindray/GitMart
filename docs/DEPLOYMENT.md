# Deployment

How GitMart gets from a merged PR to a running server, and what has to be in
place for that to work.

## Pipeline overview

```
push / PR ──────────────► CI          lint, format, unit, integration, E2E, migrations
                                      (every branch, every PR)

tag  v* ────────────────► Release     verify → create release → deploy
                                      (only tags matching v*)
```

Two workflows:

| Workflow                                          | Trigger            | What it does                                                     |
| ------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| [`ci.yml`](../.github/workflows/ci.yml)           | every push and PR  | lint, format check, unit, integration, E2E, migration check      |
| [`release.yml`](../.github/workflows/release.yml) | tags matching `v*` | re-runs the full suite, creates a GitHub Release, deploys to EC2 |

`release.yml` runs as three dependent jobs — `verify` → `release` → `deploy` —
so a failing test stops the release, and a failing release stops the deploy.

## Cutting a release

```bash
git checkout main
git pull
git tag v1.2.0
git push origin v1.2.0
```

The tag triggers everything else. Use `v1.2.0-beta` style suffixes for a
pre-release; the workflow marks those as prereleases automatically.

## Required GitHub secrets

Already configured:

| Secret               | Used for                     |
| -------------------- | ---------------------------- |
| `JWT_SECRET_KEY`     | signing access tokens in CI  |
| `JWT_REFRESH_SECRET` | signing refresh tokens in CI |
| `BCRYPT_PEPPER`      | password hashing in CI       |

**Not yet configured** — the deploy step skips itself until these exist:

| Secret        | Example                                               | Notes                                                |
| ------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `EC2_HOST`    | `ec2-13-250-x-x.ap-southeast-1.compute.amazonaws.com` | public DNS or IP                                     |
| `EC2_USER`    | `ubuntu`                                              | the SSH user                                         |
| `EC2_SSH_KEY` | contents of the `.pem` file                           | the whole private key, including the BEGIN/END lines |

Add them under **Settings → Secrets and variables → Actions**.

The deploy job checks for `EC2_HOST` and skips cleanly when it is absent, so
the workflow stays green before a host is provisioned rather than failing on a
step nobody can act on.

## What the server needs

The deploy assumes a box already set up with:

- Node.js 20 and `npm`
- `pm2`, with the app registered as `gitmart`
- the repository cloned at `~/gitmart`
- a `.env` holding `DATABASE_URL`, the JWT secrets, `BCRYPT_PEPPER`, and
  optionally the `SMTP_*` values
- a reachable PostgreSQL instance

First-time setup, roughly:

```bash
git clone https://github.com/soc-cicd/ay2627s1-project-git-5-1.git ~/gitmart
cd ~/gitmart
npm ci --omit=dev
# create .env, then apply the schema once
node scripts/reset.js          # ⚠ first install only — this DROPs every table
npm run migrate:prod
pm2 start src/server.js --name gitmart
pm2 save
```

## Database migrations

This is the part most likely to bite, so it is worth being explicit.

`npm run migration:reset` applies `schema.sql`, which **`DROP`s every table**.
That is correct for development and CI, and catastrophic in production.

Deployments instead run **`npm run migrate:prod`**, which applies the numbered
files in [`migrations/`](../migrations) exactly once each, tracking what has run
in a `schema_migrations` table.

| Command                   | Behaviour                                         | Where      |
| ------------------------- | ------------------------------------------------- | ---------- |
| `npm run migration:reset` | drops and recreates everything, then seeds        | dev, CI    |
| `npm run migrate`         | applies pending migrations against `.env.dev`     | dev        |
| `npm run migrate:prod`    | applies pending migrations using ambient env vars | the server |

### Writing a migration

Add a numbered file to `migrations/`:

```
migrations/002_short_description.sql
```

Two rules:

1. **Additive only.** No `DROP TABLE`, no `DROP COLUMN`, no destructive
   `ALTER`. A migration that loses data is not recoverable from a pipeline.
2. **Safe to run on a database that already has the change** — use
   `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   `CREATE INDEX IF NOT EXISTS`. A database freshly built from `schema.sql`
   already contains everything, so migrations must be no-ops there.

Each migration runs in its own transaction, so a failure leaves the database
untouched rather than half-migrated.

**Also update `schema.sql`** with the same change, so a fresh install and a
migrated install end up identical. The two are kept in step by hand — CI runs
the migrations against a schema-built database, which catches a migration that
conflicts with the schema, though not a schema that has drifted from the
migrations.

## Health check and rollback

After `pm2 restart`, the deploy waits five seconds then calls
`GET /api/health`. That endpoint runs `SELECT 1` rather than simply returning
200, because a process that is up but cannot reach Postgres is not actually
serving — and that is exactly the state worth catching.

If the health check fails, the deploy checks the previous commit back out,
reinstalls, restarts, and exits non-zero. The rollback restores **code**, not
data: because migrations are additive, the previous version runs fine against
the newer schema.

## Known gaps

- **No staging environment.** Tags deploy straight to production.
- **Single instance.** The SSE registry is in-process, so a second instance
  would silently drop real-time notifications — see issue #69.
- **Restart, not zero-downtime.** `pm2 restart` drops connections briefly.
  `pm2 reload` would avoid that but needs cluster mode.
- **`schema.sql` and `migrations/` are kept in step manually.**
