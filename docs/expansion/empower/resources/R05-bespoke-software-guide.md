# R05 Bespoke software guide

| Field | Value |
|---|---|
| Status | `DRAFT` |
| Audience | Client-facing |
| Review owner | Delivery founder |
| Sources | faq: custom-software, custom-web-development, crm (*owner review*), customer-portals, stripe, integrations, process-automation, replace-spreadsheets, internal-admin-systems, software-scaling, phases; `engagement-models.ts` |
| Review questions | Which published examples may appear (`AP-PROOF-01`)? Confirm CRM wording. |

---

## Custom software and automation

### When custom software makes sense

When your workflow genuinely sets you apart, when existing tools create real friction, or when your integration and data-ownership needs cannot be met by configuring a product. If a proven product already meets the need, buying and integrating it is usually the better decision, and we will tell you so.

### What we build

Customer relationship and job management systems, quote and booking workflows, customer and member portals, internal admin systems, payment and subscription integrations, and integrations with the tools you already use. Roles, permissions and sensitive operations are enforced on the server.

*[Placeholder: approved published examples.]*

### Automation

We start with one bounded workflow whose owner, inputs, exceptions and outcome can be defined. Good automation removes repeated handling while keeping the decisions people still need to make. High-consequence steps keep a human review point and a record. Simple rules and integrations are often safer and cheaper than AI; we use AI where interpretation is genuinely required.

### Replacing spreadsheets

Usually gradually: begin with the highest-friction workflow and leave stable processes in place until replacing them is justified.

### How it is priced and delivered

Custom work is scoped after discovery. It is not sold against a website starting price. We define a first release with a clear boundary, design data and permissions for the next stage, and document deployment and operations as part of delivery.

### Payments

Card details stay with the payment provider. Order and subscription status relies on verified server-side events from the provider rather than a browser redirect alone.
