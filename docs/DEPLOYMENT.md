# Deployment

How GitMart gets from a merged PR to a running server, and what has to be in
place for that to work.

## Pipeline overview

Workflows are structured as a chain of distinct jobs rather than one job with
many steps, so each stage shows as its own node in the Actions graph — a
lint failure, a test failure, and a deploy failure are visually distinct
instead of all being "the CI job went red."

```
push / PR ──► CI                Lint & Format -> Tests -> Reports -> GitHub Pages
                                 (every branch, every PR; Pages only publishes on main)

push / PR ──► Docker            Docker image builds
                                 (every branch, every PR — independent of CI)

tag  v* ────► CD Pipeline
                                 Lint & Format -> Tests -+-> Release (GitHub Release)
                                                          +-> Build (image -> GHCR)
                                                                    |
                                                                    v
                                                                 Deploy
                                 (only tags matching v*)
```

Three workflows:

| Workflow                                        | Trigger            | What it does                                                                                  |
| ----------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| [`ci.yml`](../.github/workflows/ci.yml)         | every push and PR  | lint, format check, unit, integration, E2E, migration check, QA report + Pages (main only)    |
| [`docker.yml`](../.github/workflows/docker.yml) | every push and PR  | builds the production image to prove the Dockerfile still works — never pushes it anywhere    |
| [`cd.yml`](../.github/workflows/cd.yml)         | tags matching `v*` | re-runs the full suite, builds and pushes the image, creates a GitHub Release, deploys to EC2 |

`ci.yml` runs `Lint & Format` → `Tests`, then `Reports` (regenerates the QA
dashboard and publishes it to GitHub Pages, but only actually deploys when
the push is to `main`). `docker.yml` is a single independent job, split out
from `ci.yml` since it shares nothing with that chain — it doesn't need lint
or tests to pass first, and nothing downstream needs it to finish either.
`cd.yml` runs the same `Lint & Format` → `Tests` chain, then branches into
`Release` (creates the GitHub Release) and `Build` (pushes the image to
GHCR) in parallel, before `Deploy` waits on both.

## QA dashboard (GitHub Pages)

Every push to `main` regenerates the full QA report — the same
`scripts/qa-report.js` used locally via `npm run report`, run as-is and never
edited, since it is protected and monitored by GitHub Classroom — and
publishes it to **`https://soc-cicd.github.io/ay2627s1-project-git-5-1/`**,
linking to the full report, the ESLint detail report, the coverage report,
and the Playwright E2E report.

On any other branch or PR, `Reports` still runs (so its output is available
as a downloadable Actions artifact for local review), but the `GitHub Pages`
job that actually publishes it is skipped — only `main` is allowed to
overwrite the public dashboard.

`scripts/qa-report.js` exits with a non-zero status whenever any step it ran
failed. The report-generation step uses `continue-on-error: true` so a
failing run still gets published — a red dashboard is more useful than no
dashboard at all, and is in fact the case where publishing matters most.

## Container image

The app ships as a Docker image, built from the [`Dockerfile`](../Dockerfile)
in the repo root and pushed to the **GitHub Container Registry** (GHCR) at
`ghcr.io/<owner>/<repo>`, tagged with the release tag and `latest`.

Pushing needs no new secret — it authenticates with the automatic
`GITHUB_TOKEN`, granted `packages: write` for that one job. **Pulling** the
image on the EC2 host is a separate question: by default a GHCR package
inherits the repository's visibility, so on a private repo the image is
private too, and the server needs credentials to pull it. Two ways to handle
that:

- **Make the package public** (Package settings → Change visibility, after
  the first image has been pushed at least once). Simplest option, and
  reasonable for a student project with no sensitive data in the image.
- **Add a `GHCR_PAT` secret** — a classic GitHub PAT scoped to
  `read:packages`. The deploy script logs in with it if present, and skips
  the login step entirely if it is absent, so this is opt-in.

The Dockerfile is multi-stage: dependencies (including compiling bcrypt's
native binding, which needs `python3`/`make`/`g++` on Alpine) are installed
in a `deps` stage, and only the built `node_modules` plus the application
code are copied into the final `runtime` stage. The image runs as a
non-root user and exposes a `HEALTHCHECK` using Node's built-in `http`
client rather than curl/wget, which Alpine does not ship by default.

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
| `EC2_HOST`           | SSH target for deploy        |
| `EC2_USER`           | SSH user for deploy          |
| `EC2_SSH_KEY`        | SSH private key for deploy   |

Not required, but supported:

| Secret     | Needed when                                                                  |
| ---------- | ---------------------------------------------------------------------------- |
| `GHCR_PAT` | the GHCR package is private (see above) — a classic PAT with `read:packages` |

The deploy job checks for `EC2_HOST` and skips cleanly when it is absent, so
the workflow stays green before a host is provisioned rather than failing on
a step nobody can act on.

## What the server needs

Containerising the deploy changes this list substantially from a plain Node
setup: the host runs Docker, not the app directly, so it needs neither
Node.js, `npm`, `pm2`, nor a full application checkout.

- **Docker** and the **Compose plugin** (`docker compose`, not the older
  standalone `docker-compose`)
- `curl`, for the deploy script's health check
- a shallow git checkout at `~/gitmart` — only used to fetch
  `docker-compose.prod.yml` and the [`Caddyfile`](../Caddyfile) it
  bind-mounts at the tagged version, not to run the app from
- a `.env` file at `~/gitmart/.env` holding the runtime secrets
  (`DATABASE_URL`, the JWT secrets, `BCRYPT_PEPPER`, and optionally the
  `SMTP_*` values and `APP_URL`) — never committed, created once by hand on
  the host
- a reachable PostgreSQL instance — **not** containerised alongside the app;
  see below
- the domain's DNS pointed at the instance, and inbound TCP 80/443 open in
  its security group — see "Domain and HTTPS" below

## Domain and HTTPS (Caddy)

`docker-compose.prod.yml` runs a [Caddy](https://caddyserver.com/) reverse
proxy alongside the app, configured via the [`Caddyfile`](../Caddyfile) at the
repo root. Caddy terminates TLS with a free certificate it obtains and
renews automatically (no certbot, no manual renewal cron), and forwards
everything to the app over the compose network — plain HTTP traffic to the
main app port, WebSocket upgrade requests (matched by the `Connection`/
`Upgrade` headers) to the `ws` server's port. **Caddy is the only way in from
the internet**: the app's ports are bound to `127.0.0.1` rather than
published publicly, so all traffic goes through TLS termination rather than
being able to bypass it by hitting the app directly on `:3000`/`:3001`. The
`127.0.0.1` binding still lets the deploy script's own health check
(`curl http://localhost:3000/api/health`, run directly on the host after
`up -d`) and manual debugging over an SSH tunnel reach the app — it just
isn't reachable from anywhere else.

One-time setup on a fresh host, once the DNS records below are in place:

1. At the domain registrar, add two DNS records pointing at the instance's
   public/Elastic IP:
   - `A    @      <elastic-ip>`
   - `A    www    <elastic-ip>`
2. In the EC2 instance's security group, allow inbound TCP 80 and 443 from
   anywhere (Caddy needs 80 for the ACME HTTP-01 challenge, 443 to serve).
   If 3000/3001 were opened previously for direct testing, close them again
   now — Caddy is meant to be the only public entry point.
3. Update `~/gitmart/.env` to set `APP_URL` to the `https://` domain, so
   links built into outgoing notification emails point at it.
4. Bring the stack up as usual — `docker compose -f docker-compose.prod.yml
up -d` — Caddy requests its certificate on first start.

If the domain's DNS hasn't propagated yet, or port 80 isn't reachable from
the internet, Caddy's certificate request fails and it retries with backoff
— check `docker compose logs caddy` on the host if `https://` isn't coming up.

First-time setup, roughly:

```bash
git clone https://github.com/soc-cicd/ay2627s1-project-git-5-1.git ~/gitmart
cd ~/gitmart
# create .env with the runtime secrets, then apply the schema once

docker run --rm --env-file .env ghcr.io/<owner>/ay2627s1-project-git-5-1:latest node scripts/migrate.js
```

No `docker-compose.prod.yml`/`Caddyfile` checkout is needed for that first
run — it is a one-off container from the published image, run directly. The
first tagged deploy afterwards brings both files in via the normal flow.

## Why Postgres is not containerised

`docker-compose.prod.yml` runs the app only. Production Postgres stays an
external, already-running instance, so the app container is stateless and
disposable — replacing it on every deploy loses nothing, and there is
nothing to back up on the EC2 box itself.

Containerising a stateful database on a single instance is a real option,
but a materially bigger decision: it needs a persistent volume, a backup
strategy, and a plan for what happens to that volume when the instance is
replaced. That was not asked for here and is not something to back into as
a side effect of moving the app into a container.

The local development [`docker-compose.yml`](../docker-compose.yml) is
different on purpose — it **does** run Postgres, in a disposable volume,
because losing local dev data and re-seeding is a non-event.

## Local development with Docker Compose

An alternative to the existing `npm run dev` workflow — both work, and
whether the local database is a native Postgres install or a container is
each developer's call.

```bash
docker compose up --build
docker compose exec app npm run migration:reset   # first run only
```

This starts the app on `localhost:3000` and a disposable Postgres on
`localhost:5432`. `DATABASE_URL` is overridden inside `docker-compose.yml`
to point at the `db` service by its Compose network hostname — the value in
`.env.dev` pointing at `localhost` would otherwise resolve to the app
container itself, not the database container, since each has its own
network namespace.

## Database migrations

This is the part most likely to bite, so it is worth being explicit.

`npm run migration:reset` applies `schema.sql`, which **`DROP`s every table**.
That is correct for development and CI, and catastrophic in production.

Deployments instead run **`npm run migrate:prod`**, which applies the numbered
files in [`migrations/`](../migrations) exactly once each, tracking what has run
in a `schema_migrations` table. In the containerised pipeline this runs as a
one-off container from the newly pulled image, before that image is brought
up as the running service:

```bash
docker compose -f docker-compose.prod.yml run --rm app npm run migrate:prod
```

| Command                   | Behaviour                                         | Where                         |
| ------------------------- | ------------------------------------------------- | ----------------------------- |
| `npm run migration:reset` | drops and recreates everything, then seeds        | dev, CI                       |
| `npm run migrate`         | applies pending migrations against `.env.dev`     | dev                           |
| `npm run migrate:prod`    | applies pending migrations using ambient env vars | inside the deployed container |

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

After bringing the new container up, the deploy waits five seconds then
calls `GET /api/health`. That endpoint runs `SELECT 1` rather than simply
returning 200, because a process that is up but cannot reach Postgres is not
actually serving — and that is exactly the state worth catching.

If the health check fails, the deploy switches `docker-compose.prod.yml`
back to the previous image tag and brings that up instead, then exits
non-zero. "Previous" here is tracked by hand: `IMAGE_TAG` has no equivalent
of `git rev-parse HEAD`, so the deploy script writes the tag it just
deployed to `.last-good-tag` on the host once the health check passes, and
reads that file back on the next deploy. The rollback restores **code**,
not data: because migrations are additive, the previous image runs fine
against the newer schema.

## Known gaps

- **No staging environment.** Tags deploy straight to production.
- **Single instance.** The SSE registry is in-process, so a second instance
  would silently drop real-time notifications — see issue #69.
- **Restart, not zero-downtime.** `docker compose up -d` recreates the
  container, which drops connections briefly. Blue/green or a rolling
  update would avoid that, at the cost of running two containers at once
  during the swap — not worth the complexity for a single-instance deploy.
- **`.last-good-tag` is host-local state.** Fine for one instance; would
  need to move somewhere shared (e.g. a small file in the deploy job's own
  cache, or a tag lookup against GHCR) before running more than one.
- **`schema.sql` and `migrations/` are kept in step manually.**
