# B2.11 hotfix: administrator first-login MFA enrolment

## Incident (25 Nov 2026)

A founder administrator account could not sign in after an owner reset its credentials.

**Production evidence.** Sources: `admin_security_audit`, `admin_users` and `login_rate_limits`, read-only.

| Time (UTC) | What happened |
|---|---|
| 23 Sep | The account was created. Four sign-ins were rejected with `mfa_required_not_configured`. MFA was then enrolled, during the bootstrap grace period. |
| 23 Sep – 27 Oct | The account signed in normally with TOTP. |
| 25 Nov, 15:06 | An owner invalidated the account's MFA. The code at the time set `mfa_state = null`. |
| 15:07:04 | An owner reset the password. No audit record was written: `resetAdminUserPassword` did not audit. |
| 15:02–15:08 | 22 attempts were recorded for the account's email. The limit is 5 per 10 minutes, so every attempt after the reset was refused by the login rate limiter before the password was checked, with the generic "Invalid credentials". The lockout expired at 15:12. |
| After 15:12 | A correct password reaches the MFA step. `isMfaRequired` is true for administrators in production with no grace period set, and `verifyAdminMfaChallenge` rejected privileged users without MFA. Enrolment (`/api/security/mfa`) requires a session. **Circular: cannot sign in without MFA, cannot enrol without signing in.** |

## Fix

The fix is in `admin/src/lib/server/mfa.ts`, `admin-users.ts`, `rbac.ts` and `middleware.ts`.

**Enrolment allowance.** An owner-issued, 72-hour enrolment allowance (`mfa_state.enrolment`) is issued when:
- an owner creates a privileged account; or
- an owner resets MFA (which already requires the owner's own password).

**Sign-in with an allowance.** Within the window, a correct password signs in to an **enrolment-only session**:
- The login rate limit still applies.
- The sign-in is audited as `mfa_enrolment_sign_in`.

**What an enrolment-only session can reach.** Middleware derives the restriction from the persisted user, not the token. Only these are admitted:
- `GET /security`;
- `GET/POST /api/security/mfa`;
- sign-out.

**Everything else is refused:**
- Pages redirect to `/security?reason=mfa_enrolment`.
- APIs return 403 `mfa_enrolment_required`.
- `requireCapability` and `guardPageCapability` enforce the same restriction as a second layer.

**After activation.** Activating MFA increments the session version, so the enrolment session ends. The user signs in with password and TOTP, and the allowance is dropped.

**No allowance, or an expired one.** The account stays locked out as before. The rejection is audited with the specific reason (`no_enrolment_allowance` or `enrolment_allowance_expired`).

**Password resets** are now audited as `password_reset`.

**Unchanged:**
- MFA remains mandatory;
- RBAC;
- rate limits;
- session invalidation;
- the user's id and role.

Tests:
- `admin/src/lib/server/mfa-enrolment.test.ts` (unit);
- `admin/test/e2e/b2-11-admin-mfa-enrolment.spec.ts`. This browser spec runs against the production build with mandatory MFA. It covers:
  - new administrator onboarding;
  - the restriction;
  - forced re-sign-in;
  - returning administrator sign-in;
  - owner MFA reset and owner password reset;
  - expired and missing allowances;
  - the rate limit.

## Getting the affected account signed in (after deployment)

The account's MFA was cleared by the pre-fix code, so it has no allowance. An owner must issue one:

1. **Owner:**
   1. Sign in at `https://admin.scalesmiths.co.uk` and open **Users** (`/users`).
   2. On the administrator's row, choose **Reset MFA**.
   3. Enter the owner password and choose **Reset MFA and sessions (opens a 72-hour setup window)**.
2. **The administrator:** wait at least 10 minutes after any failed attempts, so the rate limit has cleared. Then sign in at `https://admin.scalesmiths.co.uk/login` with email and password only, leaving the authenticator code blank.
3. **Set up MFA:** the browser opens **Account security**, which explains that MFA must be set up to continue.
   1. Choose **Begin MFA setup**.
   2. Add the key to the authenticator app.
   3. Save the 10 recovery codes offline.
   4. Enter the current 6-digit code and choose **Verify and activate**.
4. **Sign in again:** you are signed out automatically. Sign in with password **and** the current authenticator code.
