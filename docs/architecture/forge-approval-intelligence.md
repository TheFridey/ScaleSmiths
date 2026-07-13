# Forge approval and rejection intelligence

Forge stores structured artifact approval and rejection decisions in artifact metadata and approval history. This records meaningful review outcomes without leaking client feedback across projects.

## Rejection fields

Structured rejections support:

- primary reason;
- category;
- severity;
- client-supplied correction;
- internal note;
- whether future regeneration should use the feedback;
- whether the issue is project-specific;
- whether the issue may be reusable across projects;
- whether the artifact is fully rejected or partially accepted.

Categories are factual accuracy, tone, design preference, layout, conversion, SEO, compliance, client request, technical issue, generic output, and missing content.

## Reporting

`GET /api/forge/approval-intelligence` returns aggregate approval/rejection metrics. `GET /api/forge/approval-intelligence?projectId=:id` scopes the report to one project.

Reports include common rejection reasons, rejection rate by Forge agent, model, provider, and project type, regeneration success rate, average revisions before approval, time to approval, and fallback-output approval rate.

Global reports are statistical and do not return client corrections or internal notes. Project-specific details remain inside that project's artifact history.

## Feedback isolation

Feedback marked project-specific must not be reused for another project. Feedback marked reusable can inform future prompt/rule improvements only as an abstract pattern, not as copied client-specific wording, facts, testimonials, pricing, or corrections.
