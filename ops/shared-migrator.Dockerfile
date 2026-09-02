FROM node:22-alpine
WORKDIR /app
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY web/drizzle ./web/drizzle
COPY admin/package.json ./admin/package.json
COPY admin/drizzle ./admin/drizzle
COPY scripts/migrate-database.mjs scripts/shared-migrator.mjs scripts/shared-migration-plan.json ./scripts/
USER node
CMD ["node", "scripts/migrate-database.mjs"]
