# Forge V2 production restore evidence template

This blank record is completed by authorised operators. Empty fields mean the control has not passed.

## Identification

| Field | Recorded value |
| --- | --- |
| Backup identifier | |
| Production source timestamp (UTC) | |
| Backup source job/reference | |
| Bundle SHA-256 | |
| Encryption method and key identifier | |
| Encryption/checksum verification result | |
| Operator | |
| Independent reviewer | |
| Authorisation reference | |
| Application/source SHA | |

## Isolated target and timing

| Field | Recorded value |
| --- | --- |
| Target host and isolated database name | |
| Database isolation-comment verified by | |
| Isolated filesystem root | |
| Test-environment marker evidence | |
| Outbound integrations disabled evidence | |
| Worker/queue processing disabled evidence | |
| Restore start (UTC) | |
| Restore end (UTC) | |
| Duration and RTO result | |

## Verification results

| Check | Result and evidence reference |
| --- | --- |
| Script restore outcome | |
| Web migration journal state | |
| Admin migration journal state | |
| Forward migration verification | |
| Required table record counts | |
| Foreign-key/orphan/uniqueness checks | |
| Artifact/run/workspace integrity | |
| Generated-workspace hashes and ownership | |
| Authentication and RBAC safety | |
| No email/WhatsApp/payment/AI/provider execution | |

## Cleanup, defects, and approval

| Field | Recorded value |
| --- | --- |
| Isolated database removed (UTC/operator) | |
| Filesystem and decrypted material removed | |
| Temporary credentials revoked/removed | |
| Residual snapshot/log review | |
| Defects and incident references | |
| Operator sign-off and timestamp | |
| Independent reviewer sign-off and timestamp | |
| Restore evidence approved/rejected by and timestamp | |

Release approval: **Not implied by this record.** Record that decision separately against the exact final master SHA.
