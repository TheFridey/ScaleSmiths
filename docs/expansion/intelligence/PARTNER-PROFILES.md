# Personal partner webpages (checkpoint 5, migration 0087)

**Eligibility:** a personal-webpage reward exists for the partner (five qualifying clients under the programme). Approval of wording additionally needs that reward approved under an approved programme version; the database refuses otherwise. If the reward is later withdrawn the public page disappears.

**Workflow:** partner drafts, records consent, submits; a founder approves, requests changes or rejects; approved wording is an immutable version; a founder separately publishes it (a publication is a second immutable record); a founder can supersede or revoke it.

- **Consent** is bound to the exact wording by a database-computed content hash. Any edit clears it. Submission without matching consent is refused by the database. The consent text (`profile-consent-v1`) is a draft awaiting legal and privacy approval.
- **Slugs** are assigned by a founder, are unique, protected against reserved words, and stay bound to one partner for ever, even after revocation. Another live partner's display name cannot be reused. Display names cannot include ScaleSmiths or authority titles.
- **Content rules:** no email addresses, phone numbers or web addresses; nothing suggesting ownership, directorship, employment or guaranteed results; achievements must not mention money or earnings.
- **Public projection:** the web database role may `SELECT` only the security-barrier view `expansion_public_partner_profiles` (display name, biography, operating area, enquiry mode, opted-in referral identifier, founder-selected achievement wording, founding-recognition date). The view tests liveness on every read: live publication, active partner, entitled reward. The web role is denied every private table (tested as that role).
- **Cache behaviour:** `/partners/[slug]` renders at request time with no stored shell and is never indexed. A removal is visible on the next request (tested in a production-build browser run).
- **Switches (both default off):** `PARTNER_PROFILE_PUBLICATION_ENABLED=true` on the admin app permits publishing; `PUBLIC_PARTNER_PROFILES_ENABLED=true` on the web app serves pages. Real partner pages are a separate release gate that has not been opened.
- **Not built:** partner photographs. There is no secure upload, scanning, storage or serving pipeline, so photographs are unsupported rather than approximated.
