# JARVIS read-only integration

The admin app exposes `GET /api/jarvis/v1/{action}` through a dedicated service credential. It does not reuse browser sessions, grant writes, or expose database access to JARVIS. Only this route family is admitted to its own authentication handler; the rest of admin keeps its existing authentication boundary.

Supported actions are `clients.read`, `leads.read`, `projects.read`, `tasks.read`, `invoices.read`, `payments.read`, `retainers.read`, `proposals.read`, `analytics.read`, and `deployments.read`. Infrastructure and case-study reads are unsupported and return 404. Their absence must not be represented as an empty successful dataset.

Deploy the reviewed API through the existing release process. On the production host, with `ADMIN_DATABASE_URL` configured:

```sh
cd /var/www/scalesmiths/ScaleSmiths
node scripts/provision-jarvis-service.mjs --apply
```

If multiple owners exist, pass the intended owner's UUID using `--admin-id`. This provisions a fresh random read-only bearer token, stores only its digest and owner/session-version binding in the server `.env`, and writes `jarvis.integrations.local.json` with mode 0600. It rotates any previously provisioned JARVIS token. Restart admin using its actual process manager. Disabling the owner or revoking that owner's sessions revokes service access; rotate/reprovision deliberately when restoring it.

Transfer the credential fragment through an authenticated SSH/SCP connection into the JARVIS protected local runtime directory. Do not paste it into chat, commit it, or serve it over HTTP. Merge the `scalesmiths` member with any existing Kernel integration configuration; preserve other providers. Set `JARVIS_INTEGRATIONS_CONFIG` to that file in JARVIS's ignored `.env` and restart the Kernel. The Kernel registers only the supported read actions. `writeScopes` remains empty.

Each read requires an explicit action scope and the current bound owner's RBAC capability. The handler rejects invalid/revoked credentials, rate limits authenticated reads to 120/minute, runs fixed projections inside the existing aggregate RLS context, bounds query duration and page size, logs metadata without records or credentials, and returns private/no-store responses. Query fields are `id`, `clientId`, `cursor`, and `limit` (1–100). A non-final page includes a cursor; filtered pages cannot establish whole-business totals.

Invoice amounts are integer minor units. CRM MRR and proposal prices are whole GBP in the source schema and are converted to integer pence at this boundary. `payments.read` represents paid-invoice settlements, not a payment-processor transaction ledger. Retainers represent CRM monthly-retainer records, not signed contract verification. Deployment records are Forge candidates and do not certify a live release. Analytics values retain source attribution and metric dates; missing values stay null.

Source update timestamps remain distinct from retrieval time. Records expire in the JARVIS projection after fifteen minutes and are marked RESTRICTED. JARVIS must continue using its Credential Broker, Executor and Knowledge Ingestion boundaries. Private records are not included in the ordinary cloud conversation context.
