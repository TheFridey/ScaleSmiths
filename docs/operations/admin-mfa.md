# Admin MFA and session security

ScaleSmiths supports optional RFC 6238 TOTP MFA for privileged admin identities. In production it is mandatory for `owner` and `administrator` after the configured bootstrap grace deadline.

## Cryptography and storage

- TOTP uses SHA-1, six digits, 30-second steps, and a one-step clock-skew window, matching standard authenticator applications.
- Each random TOTP secret is encrypted with AES-256-GCM before storage in `admin_users.mfa_state`.
- `MFA_ENCRYPTION_KEY` must encode exactly 32 random bytes as base64 or 64 hexadecimal characters. Production fails closed when it is absent or invalid.
- Ten random recovery codes are shown once during setup. Only independently salted scrypt hashes are stored. A recovery code is transactionally locked and removed on use.
- Audit rows contain user IDs, action, outcome, method/reason, and counts only. They never contain passwords, TOTP secrets/codes, recovery codes, encryption keys, or QR/URI data.

Generate a key, for example:

```bash
openssl rand -base64 32
```

Store it in the root VPS `.env` as `MFA_ENCRYPTION_KEY`. Back it up in the secrets manager: losing it makes existing authenticator secrets unreadable and requires owner-controlled MFA invalidation/re-enrolment.

## Bootstrap grace path

Before deploying mandatory MFA, set a short future ISO-8601 deadline:

```dotenv
ADMIN_MFA_BOOTSTRAP_GRACE_UNTIL=2026-07-11T18:00:00Z
```

During that window an owner/administrator without active MFA can sign in with a password and enrol at `/security`. Setup returns a manual Base32 secret, an `otpauth://` URI, and recovery codes. MFA remains inactive until a valid authenticator code verifies the secret. Activation increments the session version and signs the operator out; the next login must include TOTP or a recovery code.

After all privileged users have enrolled, remove the grace variable or set it in the past and restart admin. Do not deploy with an expired/missing grace value before at least one owner has active MFA.

## Login and recovery

The login form accepts password plus either a six-digit authenticator code or one recovery code. Password validation happens first. Failed MFA challenges are rate-limited by the existing login limiter and persisted in `admin_security_audit`.

An owner can invalidate another user's MFA from `/users` only after re-entering the owner's current password. This clears encrypted MFA state, revokes the target's sessions, and writes an audit event. The target must re-enrol; privileged production users need a temporary grace window to sign in without MFA.

Emergency owner recovery remains the CLI process in `admin-identity.md`. When recovery clears or replaces access for an owner without valid MFA, set a tightly bounded `ADMIN_MFA_BOOTSTRAP_GRACE_UNTIL`, restart admin, enrol immediately, then remove the grace setting.

## Session controls

- Auth.js JWT sessions expire after eight hours.
- The production session cookie uses the `__Secure-` prefix and is `Secure`, HTTP-only, SameSite=Lax, and path `/`.
- JWTs are encrypted/signed by Auth.js and refreshed through its session lifecycle.
- Node middleware reloads the identity on every protected request and rejects disabled accounts or mismatched session versions.
- Password reset, MFA activation/invalidation, explicit revocation, account disablement, and privilege-reducing role changes increment the session version.

## Deployment

Run migrations through `0017_admin_mfa_audit`, set `MFA_ENCRYPTION_KEY` and the initial grace deadline, then deploy admin. Validate enrolment and a fresh MFA login in staging before enforcing production.
