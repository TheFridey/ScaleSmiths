# Forge economics dashboard

The internal dashboard is available at `/forge/economics` and requires normal Forge read access. It aggregates normalized usage records by project, client, task stage, provider, model, and calendar period. Date filters provide day, week, month, or arbitrary reporting windows; project, client, provider, model, and stage filters narrow the same dataset. Filtered rows can be exported as CSV.

Provider cost is estimated from normalized token usage and the application pricing model. Retry cost is an attribution estimate based on task retry counts. Latency comes from stored task output metadata. Fallback rate includes deterministic/mock and explicitly fallback-quality tasks.

Completed-site and approved-artifact denominators use deployed Forge projects and approved/system-validated artifacts. Proposal value uses Forge-generated sales proposal build prices. Gross margin impact is proposal value minus estimated AI cost; it is not accounting gross margin and excludes labour, hosting, tax, payment fees, provider invoice adjustments, and uncollected proposals.

All financial values are labelled estimates. No confirmed provider billing or payment ledger is currently connected. Alerts highlight a latest-day spike above twice the recent daily average and projects at or above 80% of their configured estimated AI budget.
