# Cloudflare Access and admin origin hardening

## Scope and current topology

The public site (`scalesmiths.co.uk` -> `127.0.0.1:3100`) remains public. Only `admin.scalesmiths.co.uk` and any optional Forge hostname are Access applications. Docker publishes both applications on loopback, and PostgreSQL is not published by the host-Nginx Compose variant.

`https://admin.scalesmiths.co.uk` is the canonical Auth.js and admin origin. Cloudflare Access, Nginx, portal links and production environment values must preserve that hostname; the public origin does not host an admin path.

The baseline host configuration previously accepted direct admin traffic and appended inbound `X-Forwarded-For`. The admin block now overwrites that header. For production, replace only its two admin server blocks with `nginx/cloudflare-access-admin.example.conf`.

## Cloudflare setup

1. Proxy the admin DNS record through Cloudflare and use SSL/TLS **Full (strict)**.
2. In Zero Trust, create a self-hosted Access application for `admin.scalesmiths.co.uk/*`. Create a separate application for `forge.scalesmiths.co.uk/*` if that hostname is enabled.
3. Use an Allow policy with explicit company IdP groups or named identities. Add MFA as a Require rule, use a short session duration for privileged users, and leave unmatched users denied. Do not use an Everyone or broad email-domain rule.
4. Keep application RBAC and TOTP enabled: Access is an additional boundary, not a replacement.
5. Test denial in a logged-out browser and from a non-member identity before changing the origin firewall.

Do not create an Access bypass for `/api/health`. Infrastructure calls the loopback-bound admin service directly and supplies `X-Health-Check-Token`.

## Trusted proxy and anti-spoofing model

Cloudflare ranges are never committed or hard-coded. Install refreshed Nginx snippets atomically:

```sh
sudo node scripts/update-cloudflare-nginx-ranges.mjs /etc/nginx/snippets
sudo nginx -t && sudo systemctl reload nginx
```

Run this from a scheduled systemd timer at least daily and alert on failure. The example validates the original TCP peer using `$realip_remote_addr`, then accepts `CF-Connecting-IP` only from generated trusted ranges. It replaces `X-Real-IP`, `X-Forwarded-For`, scheme, host and port before proxying. A direct client therefore cannot manufacture a trusted forwarding chain.

Download the updater over a controlled deployment channel; do not curl-and-execute it. Review generated diffs and retain the prior working snippets when fetching or validation fails.

## Origin restrictions

Preferred order:

1. Keep application ports bound to `127.0.0.1` as in `docker-compose.host-nginx.yml`.
2. Enforce Cloudflare peer ranges in the admin Nginx virtual host using the reviewed example.
3. Where admin has a dedicated origin IP, restrict inbound 80/443 at the provider firewall to current Cloudflare ranges and an explicit emergency management path.
4. Optionally enable Authenticated Origin Pulls, preferably with a per-hostname certificate. This complements, but does not replace, Access.

A host firewall cannot distinguish hostnames sharing one IP before accepting the connection. Do not globally restrict 80/443 to Cloudflare on the shared origin unless the public site is also proxied and that operational change has been tested. The per-server Nginx peer check hardens admin while leaving the public site behavior unchanged.

For firewall allowlisting, use the same Cloudflare API as the updater and an atomic nftables/ipset/provider-firewall update. Never paste a permanent range list into repository code. Always preserve SSH/console recovery access and validate a second session before applying rules.

## Internal health check

Set `ADMIN_HEALTH_CHECK_TOKEN` to at least 32 random characters. The endpoint is intentionally hidden by the Cloudflare-facing Nginx server and can be checked on the host:

```sh
curl --fail --header "X-Health-Check-Token: $ADMIN_HEALTH_CHECK_TOKEN" http://127.0.0.1:3101/api/health
```

It reports only service, environment, release and status. It does not test PostgreSQL readiness or disclose dependency details. Missing/incorrect tokens receive a generic 401 response.

## Rollout and rollback

Generate snippets, run `nginx -t`, then replace only the admin server blocks and reload. Verify Access allow/deny, direct-origin denial, login, Forge task pages and the loopback health check. Keep an existing root session open. Roll back by restoring the prior admin blocks; do not alter the public blocks.

## Production security checklist

- [ ] Admin and optional Forge DNS records are proxied; public DNS behavior is unchanged.
- [ ] Access applications use explicit identities/groups, MFA requirements and short sessions.
- [ ] No Access bypass exists for login, Forge APIs, previews or health.
- [ ] Cloudflare range refresh is scheduled, monitored and followed by `nginx -t` before reload.
- [ ] Direct admin origin requests are rejected and forwarding-header spoof tests fail.
- [ ] App ports bind to loopback; PostgreSQL and generated workspaces are not public.
- [ ] `ADMIN_HEALTH_CHECK_TOKEN` is random, server-only and present in infrastructure secrets.
- [ ] TLS is Full (strict); optional Authenticated Origin Pulls is tested before enforcement.
- [ ] Firewall changes preserve emergency SSH/provider-console access.
- [ ] Cloudflare and origin logs are monitored for Access denials and unexpected direct traffic.
- [ ] Admin Auth.js, RBAC, MFA, session revocation and rate limiting remain enabled.
- [ ] Recovery and rollback are tested by two authorised operators.

## References

- Cloudflare: IP addresses and programmatic range updates
- Cloudflare: HTTP request headers and `CF-Connecting-IP`
- Cloudflare: Access self-hosted applications and policy rules
- Cloudflare: Authenticated Origin Pulls
