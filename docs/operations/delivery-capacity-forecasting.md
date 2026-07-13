# Delivery capacity forecasting

The admin operations dashboard at `/operations/capacity` forecasts delivery capacity from existing ScaleSmiths records. It is deliberately conservative: Forge workload is not treated as free capacity, probable sales work is separated from confirmed work, and assumptions are shown on the page.

## Inputs

- Active Forge projects and latest project estimate snapshots.
- Forge task and artifact approval state, including degraded or fallback work.
- Client requests that are not completed or cancelled.
- Active client retainers inferred from client MRR.
- Probable sales work from prospects in discovery, proposal, or follow-up stages.
- Manual capacity adjustments from `delivery_capacity_adjustments`.
- Forecast-versus-actual records from `delivery_forecast_actuals`.

## Outputs

The dashboard shows:

- active projects and estimated remaining effort;
- assigned project owner where recorded;
- delivery risk and confidence;
- client and internal approval bottlenecks;
- upcoming deadlines;
- Forge workload versus manual workload;
- retainer obligations;
- available capacity after manual adjustments;
- probable incoming work separately from confirmed commitments;
- work waiting on clients and internal approvals;
- weekly and monthly capacity forecasts;
- single-person dependencies;
- forecast-versus-actual variance.

## Manual adjustments

Use manual adjustments for known operational context that is not represented elsewhere:

- `capacity_override` for a planned capacity baseline;
- `time_off` for holidays, sickness or unavailable delivery time;
- `contractor_capacity` for approved external delivery help;
- `sales_commitment` for sold work not yet represented by a Forge project.

Every adjustment requires a reason and records the actor that created it.

## Forecast versus actual

Actual delivery records let the team compare planned hours with real hours. This is used for calibration reporting; it should not be edited into historic estimates.

## Assumptions and limitations

- Default capacity is 32 human delivery hours per week until adjusted.
- Retainer effort is inferred from MRR until explicit allocation exists.
- Probable work is weighted by sales stage and remains separate from confirmed commitments.
- Forge generation still carries human review, QA, approval and repair effort.
- Single-person dependencies are inferred from assigned owner plus material remaining effort; this should be tightened when staff assignment data becomes richer.

## Migration

Run the normal Drizzle migration flow. This stage adds:

- `delivery_capacity_adjustment_type`
- `delivery_capacity_adjustments`
- `delivery_forecast_actuals`
