# Explainable Lead Scoring

ScaleSmiths lead scoring is deterministic and evidence-led. It uses existing prospect pipeline data, outreach activity and proposal tracking records to create versioned score snapshots.

## Data Used

The scorer may use:

- Prospect business category, source, stage and priority.
- Existing website URL and the manual revenue/trust/conversion/SEO/mobile audit scores.
- Budget and retainer estimates or tracked proposal values.
- Named contact route, not inferred personal traits.
- Outreach engagement counts and recent activity dates.
- Sales notes for urgency, required scope, retainer signals and strategic-fit evidence.

The scorer must not use protected or inappropriate personal characteristics such as age, sex, gender, race, religion, disability, marital status or similar traits. These fields are not collected by the scorer and do not appear in the affected-data list.

## Output

Each snapshot records:

- Score from 0 to 100.
- Confidence level and close probability.
- Positive, negative and neutral factors.
- Missing information.
- Exact fields that affected the score.
- Recommended next action.
- Estimated project value and retainer potential.
- Scoring model version.

Human overrides are stored beside the deterministic score with an override score, actor, timestamp and reason. Overrides do not erase the original score.

## Calibration

Final outcomes can be recorded against a score snapshot:

- `won`
- `lost`
- `no_decision`
- `disqualified`

Outcome value and retainer value are stored for later calibration reporting. This allows ScaleSmiths to compare deterministic score, human override and actual outcome over time.

## Operations

Run the lead-score migration before using the feature in production:

```bash
cd admin
npm run db:migrate
```

Scores are generated from the Prospect Pipeline detail panel. Use the override field only when human judgment has specific evidence not yet represented by the structured fields, and record the reason in plain business terms.
