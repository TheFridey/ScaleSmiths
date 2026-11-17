# Security model

## Identity

Reuse Auth.js, bcrypt, current persisted identity and sessionVersion validation. Partners receive only `expansion.partner`. Founders use `expansion.manage`; no generic sales/viewer role is safe for external users. Partner requests deny every unrelated path including unknown pages and internal APIs. Resource services derive ownership from the authenticated user, never a client-provided partner identifier.

## Recruitment and activation

Applications are public untrusted input, size bounded, server validated, rate limited and disabled by default until privacy/operations approval. No sensitive banking data. Invitations require legal, agreement, independent-status and operational confirmations, are hashed at rest, expire and are consumed once under a transaction lock. In-principle approval does not activate an identity. Revocation disables the existing identity and increments session version.

## Mutations and documents

Authenticated mutation endpoints require same-origin requests; Auth.js retains its own CSRF protocol. All partner reads/writes are owner scoped. Founder commands recheck persisted capability. Duplicates reveal no owner/name/status. Resource content is published text; arbitrary private file paths and unsafe uploads are not exposed. Private responses use no-store.

## Finance

Integer minor units and versioned rules; commission arises only from verified collected revenue on approved contracts. Append-oriented events, exact replay fingerprints, unique references, locks and transactional ledger writes. Refund decisions require founder approval under reviewed terms. Paid entries are never silently rewritten. Payouts are manually approved and reconciled records, never bank execution.

## Release gates

No production deployment, external messages, live provider spend or payment execution. Require protected-area review, isolated DB evidence, negative authorization tests, privacy retention approval, final partner agreement and accounting review before activation of real partners.
