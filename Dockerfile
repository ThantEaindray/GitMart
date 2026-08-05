# ─────────────────────────────────────────────────────────
#  GitMart — production image
# ─────────────────────────────────────────────────────────
#  Two stages: install dependencies, then copy only what the
#  running app needs into a slim final image. Build tools
#  (needed by bcrypt's native binding) stay in the first
#  stage and never reach the image that actually ships.
# ─────────────────────────────────────────────────────────

# ── deps ─────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# bcrypt compiles a native binding on install. Alpine's musl libc means the
# package's prebuilt binaries usually do not match, so it falls back to
# building from source — these are the tools that requires.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Runs as an unprivileged user rather than the default root, so a container
# escape does not hand over root on the host.
RUN addgroup -S gitmart && adduser -S gitmart -G gitmart

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY schema.sql ./
COPY migrations ./migrations
# The whole folder, not just migrate.js: reset.js (used by local dev to
# bootstrap the database) shells out to seed.js, so both need to be present
# too, or `docker compose exec app npm run migration:reset` fails looking
# for a file that was never copied in.
COPY scripts ./scripts

USER gitmart

# 3000 is the HTTP app; 3001 is the chat WebSocket server (WS_PORT). The code
# defaults WS_PORT to 443, which needs root to bind — the non-root user above
# cannot, so the compose files below override it to 3001 at runtime.
EXPOSE 3000 3001

# Uses Node's built-in http client rather than curl/wget, which Alpine does
# not ship by default — avoids adding a package just for this.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
