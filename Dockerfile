# trends° by upTake — image de production (sortie standalone de Next.js).
# Construite par GitHub Actions à chaque push sur main, déployée par Coolify (docs/deploy.md).
# Aucun secret au build : tout est lu à l'exécution, sauf les NEXT_PUBLIC_* (passés en build args).

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml ./
COPY scripts/copy-flags.mjs ./scripts/copy-flags.mjs
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG NEXT_PUBLIC_SITE_URL=https://trends.uptake.me
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
ARG NEXT_PUBLIC_UPTAKE_SCRIPT_SRC=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_UPTAKE_SCRIPT_SRC=$NEXT_PUBLIC_UPTAKE_SCRIPT_SRC \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node scripts/copy-flags.mjs && pnpm build

# Migrations au démarrage (scripts/migrate.mjs) : seul le client postgres, à la même version que package.json
FROM base AS migrator
WORKDIR /migrator
COPY package.json /tmp/package.json
RUN echo '{"type":"module","private":true}' > package.json \
 && npm install --omit=dev --no-audit --no-fund "postgres@$(node -p 'require("/tmp/package.json").devDependencies.postgres')"

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=migrator --chown=nextjs:nodejs /migrator ./migrator
COPY --chown=nextjs:nodejs scripts/migrate.mjs ./migrator/migrate.mjs
COPY --chown=nextjs:nodejs supabase/migrations ./migrator/migrations
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
# Migrations d'abord (DATABASE_URL) ; en échec, le conteneur s'arrête et Coolify garde l'ancien
CMD ["sh", "-c", "node migrator/migrate.mjs && exec node server.js"]
