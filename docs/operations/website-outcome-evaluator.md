# Website outcome evaluator

The website outcome evaluator appears on each client analytics page. It reviews approved post-launch admin data and analytics rollups to assess whether a launched client website appears to be achieving its intended goals.

## Inputs

- Intended conversion strategy from the linked Forge/client project goal.
- Client analytics daily metrics.
- Source attribution from analytics configs and metric rows.
- Lead outcome records where the prospect was converted to the client.

## Outputs

The evaluator returns:

- strong evidence;
- weak signals;
- hypotheses;
- recommended investigations;
- suggested improvements;
- confidence;
- required client decisions;
- incomplete or biased data warnings.

## Guardrails

- It does not claim causation from aggregate post-launch metrics.
- It does not modify live websites.
- It does not name high-traffic low-conversion pages unless page-level aggregate evidence exists.
- It does not compare mobile and desktop performance unless device-level evidence exists.
- It links conclusions to client-scoped source metrics.
- It preserves client isolation by loading analytics through `clientId`.

## Known current limitation

The current analytics ingestion layer stores privacy-conscious daily aggregate metrics. Page-level, device-level and before/after baseline comparisons are therefore usually reported as incomplete until reviewed aggregate sources are connected.
