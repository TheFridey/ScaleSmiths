<!-- Current checkpoint: #164, #165, #163, #170 and #166–#169 merged into master on 22 November 2026; B2.5 is in draft #171. The table below retains historical development staging and proposed approvals. -->
# Operation Ascend (B2): roadmap and dependency register

## Delivery sequence

| # | Slice | Depends on | Status |
|---|---|---|---|
| 0a | Forge preview approval reliability ([#164](https://github.com/TheFridey/ScaleSmiths/pull/164)) | master | Draft PR, CI green, awaiting human review |
| 0b | Admin hydration marker for history navigation (`claude/awesome-hawking-ximwzj`, `f3e6f4d`) | master | Draft PR opened by Ascend Phase Zero (see STATUS) |
| 0c | B1.7 Project Aegis ([#163](https://github.com/TheFridey/ScaleSmiths/pull/163)) | master | Draft PR, CI green, awaiting founder decisions and human review |
| 1 | B2.1 Advanced partner pipeline | master | Implemented on `feature/operation-ascend-b2`, switched off |
| 2 | B2.2 Qualification | B2.1 | Implemented on `feature/operation-ascend-b2-2` (stacked), switched off |
| 3 | B2.3 Founder sales command centre | B2.1, #163 | Implemented on `feature/operation-ascend-b2-3` (stacked), switched off; `founderOperations` left untouched for #163 |
| 4 | B2.4 Revenue intelligence and forecasting | finance engine (master) | Implemented on `feature/operation-ascend-b2-4` (stacked), switched off |
| 5 | B2.5 Partner performance | B2.1, B2.2 | Implementation underway on draft PR #171, partner-only; any new founder visibility remains blocked on Academy privacy decision |
| 6 | B2.6 Delivery handoff | B2.3 | Not started; Forge integration contract undefined |
| 7 | B2.7 Automation and full acceptance | B2.3, B2.6 | Not started |

Recommended merge order for Phase Zero: **#164 → hydration fix → #163**. #164 and the hydration fix touch disjoint files; #163 is the largest and benefits from a stable E2E baseline.

## Operational risk register (carried from B1; none resolved by B2)

| ID | Risk | Owner | State |
|---|---|---|---|
| OR-1 | `admin.scalesmiths.co.uk` redirects to `www.confirmakill.co.uk` (security and trust) | Founder (DNS/hosting) | **Open.** Proposed correction below; no DNS change made |
| OR-2 | Canonical admin hostname unresolved | Founder | Open |
| OR-3 | Production error monitoring disabled | Founder | Open |
| OR-4 | Production off-host backups unverified | Founder | Open |
| OR-5 | Resend configuration incomplete | Founder | Open |
| OR-6 | AP-COM-03 founder decision | Founder | Open |
| OR-7 | Approved partner agreement text not available to the portal | Founder + solicitor | Open |
| OR-8 | Agreement jurisdiction binding not enforced | Engineering after legal decision | Open |
| OR-9 | Content approvals outstanding | Founder | Open |

### OR-1 proposed correction (not applied)

Diagnose before changing anything, from a machine outside the hosting network:

```bash
dig +short admin.scalesmiths.co.uk A AAAA CNAME
curl -sSI https://admin.scalesmiths.co.uk/login | sed -n '1,12p'
```

Likely causes, in order: (1) the admin hostname's DNS record points at the host that serves Confirm a Kill and that host's default nginx `server` block answers with its redirect; (2) the admin `server_name` is missing from the admin nginx site, so the request falls to the default server; (3) a registrar-level URL forward. The fix is to give `admin.scalesmiths.co.uk` an explicit nginx `server` block (TLS certificate for that name, `proxy_pass` to the admin app) and make the default server return `444` instead of redirecting to another product. This requires founder approval and production access; nothing has been changed.

## Founder decisions raised by Ascend

- **FD-ASC-01** Does Ascend's B2 supersede the earlier B2–B6 labels?
- **FD-ASC-02** Retention period for partner interaction notes (`expansion_opportunity_interactions`). Proposed: same as the opportunity's commercial history; partner offboarding keeps them read-only.
- **FD-ASC-03** Whether founders may ever reassign an opportunity between partners, and what happens to commission entitlement.
- **FD-ASC-04** Whether founders may see partner interaction notes (currently partner-only; no founder view exists).
- **FD-ASC-05** Minimum history before forecasts show a conversion rate (B2.4).
- **FD-ASC-06** Whether a budget answer should stay mandatory for scope submission (current rule) or become voluntary as the Ascend directive suggests.
