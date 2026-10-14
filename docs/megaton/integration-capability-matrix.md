# Megaton integration capability matrix

Documentation audit, 13 October 2026. No connection or live capability test performed. **Yes** means documented tool/API exists, subject to scopes, entitlement, review and policy. **Limited** means account/action-specific restrictions. **App** means our scheduler around an approved send/publish action. **Unverified** means not established; it is not a claim that the provider has no API. **Not listed** means absent from the inspected connector catalog, not permission to scrape or automate browser messaging.

| Platform | Connect | Publish | Schedule | Read comments | Reply comments | Read DMs/mail | Send DMs/mail | Search | Analytics | Events |
|---|---|---|---|---|---|---|---|---|---|---|
| Gmail | OAuth, scoped | Mail send | App | N/A | N/A | Yes | Yes | Mailbox search | Limited delivery/history, not marketing attribution | Managed triggers, polling latency |
| Microsoft 365 | Provider OAuth possible; connector verification pending | Mail send via Graph | App | N/A | N/A | Graph supported | Graph supported | Mailbox scoped | Limited | Graph subscriptions; adapter validation pending |
| LinkedIn | OAuth, app permissions | Yes, eligible member/org | App | Provider API with approved permissions; connector read not established | Listed connector tools | Not listed | Not listed | Limited profile/org actions, not unrestricted people search | Org/share scope limited | Unverified |
| Facebook | Eligible Pages, not personal profile automation | Yes | Listed scheduled-post actions | Yes | Yes | Page inbox | Page messaging, policy restricted | Page search, limited | Page insights | Provider webhook permissions; end-to-end not verified |
| Instagram | Business/creator, login model matters | Eligible media | App | Yes | Yes | Eligible conversations | Restricted eligible messaging | Limited business/hashtag functions | Eligible insights | Listed webhook subscription actions; app review |
| X | Own developer OAuth app; no managed OAuth in catalog | Yes | App | Replies via tweet/conversation APIs | Reply post | Listed tools | Listed tools; scopes/access rules | Entitlement-dependent | Listed tools, tier dependent | Listed subscription action; access-dependent |
| TikTok | Own developer app/OAuth; review | Listed photo/video actions | App | Not listed | Not listed | Not listed | Not listed | Own/eligible video queries, not general lead search | Limited user/video stats | Publishing status; inbox events unverified |
| YouTube | Google OAuth, scoped | Video upload | Provider scheduling requires publishAt eligibility/schema verification | Yes | Yes | No private DM tool listed; live chat is separate | No private DM tool listed | Public video/channel search | Scoped analytics | Connector triggers; quota/auth requirements |
| Threads | Meta API OAuth; Composio connector unverified | Meta API documented | App, pending action verification | Replies API documented | Replies API documented | Unverified | Unverified | Scope/endpoint validation required | Meta API insights documented | Unverified |
| WhatsApp | Business platform/provider onboarding required | Not a social feed | App | N/A | N/A | Business inbound webhook possible | Templates/session and consent rules; adapter not selected | No general prospect directory | Provider delivery metrics | Provider webhook; not implemented |

The mailbox choice must follow the actual ScaleSmiths provider. IMAP/SMTP may require a direct adapter and bounded polling rather than Composio. Resend is currently transactional delivery, not proof of a unified email inbox. Instagram personal accounts and Facebook personal profiles cannot simply be treated as their business/Page equivalents. LinkedIn outreach DMs and TikTok DMs must not be promised from the inspected catalog.

Provider documentation can show a feature that a connector has not wrapped. Only add a direct/proxy adapter after verifying its schema, permissions, platform terms and budget. Do not call publishing schedules native when implemented by our own worker. Incoming event support does not establish instant delivery or access to every conversation.

## Sources and verification boundary

The following official connector catalogs were inspected for action coverage; their existence does not establish owner-account permissions:

- [Gmail](https://docs.composio.dev/toolkits/gmail), [LinkedIn](https://docs.composio.dev/toolkits/linkedin).
- [Facebook](https://docs.composio.dev/toolkits/facebook), [Instagram](https://docs.composio.dev/toolkits/instagram).
- [X](https://docs.composio.dev/toolkits/twitter), [TikTok](https://docs.composio.dev/toolkits/tiktok), [YouTube](https://docs.composio.dev/toolkits/youtube).
- [Meta's Threads API collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api). Accessible Composio Threads documentation did not establish a connector; treat transport and inbox as unverified.
- [Composio triggers](https://docs.composio.dev/docs/triggers), [custom auth configurations](https://docs.composio.dev/docs/auth-configuration/custom-auth-configs), [explicit tool authentication](https://docs.composio.dev/docs/tools-direct/authenticating-tools).
- [Microsoft Graph messages](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0) and [Outlook change notifications](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview) document mailbox operations and subscriptions; connector/account acceptance remains pending.
- [YouTube video resource](https://developers.google.com/youtube/v3/docs/videos) documents scheduled publication through `status.publishAt`, subject to its restrictions; the selected connector schema must still be checked.
- [Meta WhatsApp Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) provides the official business-platform API reference; no WhatsApp adapter is selected or connected.

Account-specific Microsoft Graph scopes, WhatsApp onboarding and templates, the selected YouTube connector schema and platform-specific messaging windows require further review before implementation. These cells are documented feasibility statements, not live integration or release commitments. The Phase 1 company mailbox is the only proposed live communication channel. Social adapters are subsequent individually accepted work.
