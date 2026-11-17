# Data model and migration strategy

Web owns recruitment applications: bounded personal/contact/experience data, privacy version, submission time, lifecycle, review notes and retention deadline. Admin may review these shared records; migration ownership remains web.

Admin owns partner profiles linked uniquely to existing `admin_users` and application; invitation hashes/expiry and agreement confirmations; opportunity metadata linked to canonical `prospects`; scope/discovery versions; approved contract snapshots linked to canonical clients; capacity reservations; approved versioned resource content; verified payment events linked to canonical invoices; append-only commission entries and manual payout records; action audit events.

Use foreign keys with restrictive deletion for financial lineage, unique invitation/event references, nonnegative qualifying collection limits, indexes on partner ownership, and explicit transition checks. Store financial minor units as exact integers/decimal strings at serialization boundaries. No duplicate client or invoice tables. Financial correction is forward/append-only.

Add forward migrations only, with journal entries and checksum lock updates through repository conventions. Root shared planner applies both histories. Verify upgrades in an isolated database. Rollback application admission first, preserve financial rows, and use a reviewed forward correction rather than dropping histories.
