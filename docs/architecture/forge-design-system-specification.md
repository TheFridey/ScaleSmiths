# Forge Design-System Specification

Forge now creates a first-class `design_system` artifact between approved design direction and generated-page implementation.

The artifact is intentionally stricter than the design direction. Design direction explains the creative approach; the design-system specification locks the implementation vocabulary:

- brand attributes and approved fact references
- required named tokens for colour, typography, spacing, containers, radius, shadows and borders
- button, form, card, navigation, footer, section, image, icon, motion, responsive and accessibility rules
- optional creative guidance separated from required tokens
- prohibited style values such as ad hoc colours, arbitrary max-widths and viewport-scaled type

Generation is queue-backed through `design_system` jobs and writes a new versioned artifact using the provenance layer. Regeneration supersedes earlier versions but does not overwrite history. Approval creates a new validated artifact version with approval history and human-edit tracking.

Downstream gates:

- component specification generation requires an approved design-system artifact
- generated-page implementation requires an approved design-system artifact
- the implementation contract disallows arbitrary style values and should consume approved token ids or approved guidance

Generated-page implementation now emits the approved design-system into:

- CSS custom properties in `src/app/globals.css`
- Tailwind aliases that point to those custom properties
- type-safe token metadata in `src/lib/design-tokens.ts`
- an internal `/style-guide` route demonstrating typography, colours, buttons, forms, cards, alerts, navigation, sections, icons, responsive behaviour and motion states

The generated-code summary includes `/style-guide`, so screenshot visual QA captures it with the other critical routes. Fetch-based visual QA fallback also verifies that the style-guide route renders.

The schema is source-controlled in `admin/src/lib/forge-design-system.ts` and registered as `forge.design-system` / `forge.design-system-specification` version `1.0.0`.
