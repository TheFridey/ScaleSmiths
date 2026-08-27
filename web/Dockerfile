# syntax=docker/dockerfile:1.7
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS node-base
RUN apk add --no-cache libcrypto3=3.5.8-r0 libssl3=3.5.8-r0

FROM node-base AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund \
      --fetch-retries=5 \
      --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 \
      --fetch-timeout=300000

FROM node-base AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund \
      --fetch-retries=5 \
      --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 \
      --fetch-timeout=300000
COPY . .
ARG ERROR_MONITORING_RELEASE
ARG SENTRY_ORG
ARG SENTRY_WEB_PROJECT
ENV ERROR_MONITORING_RELEASE=${ERROR_MONITORING_RELEASE} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_WEB_PROJECT=${SENTRY_WEB_PROJECT}
RUN --mount=type=secret,id=sentry_auth_token \
    if [ -f /run/secrets/sentry_auth_token ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; fi; \
    npm run build

FROM node-base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Next's file tracer can retain Drizzle Kit's build-only esbuild binary even though
# no production route imports it. Keep the runtime image free of unused toolchain code.
RUN rm -rf /app/node_modules/@esbuild /app/node_modules/esbuild
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
