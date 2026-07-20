# Refine Batch 1 — Deliverable

## Summary

Created 4 new English-speaking practice scenarios for the Speakly app under `/workspace/content/refine/`. The 4 scenarios cover the full garment-export order lifecycle: shirt production, order management, exception handling, and post-mortem review. Each scenario ships with 3 difficulty levels (12 dialog files total, all 8 rounds each), a 76-entry vocabulary list, and 3 difficulty-level system prompts. The backend will hot-reload the new content from `/workspace/content/refine/` on restart — no backend or frontend code was modified.

## Changed files

All files are new; nothing was modified.

### Scenarios (master list)
- `/workspace/content/refine/scenarios.json` — 4 scenarios with metadata, key skills, industry terms, tags

### Dialogs (12 files = 4 scenarios x 3 difficulties)
- `/workspace/content/refine/dialogs/shirt_production.json` — beginner (8 rounds)
- `/workspace/content/refine/dialogs/shirt_production_intermediate.json` — intermediate (8 rounds)
- `/workspace/content/refine/dialogs/shirt_production_advanced.json` — advanced (8 rounds)
- `/workspace/content/refine/dialogs/order_management.json` — beginner (8 rounds)
- `/workspace/content/refine/dialogs/order_management_intermediate.json` — intermediate (8 rounds)
- `/workspace/content/refine/dialogs/order_management_advanced.json` — advanced (8 rounds)
- `/workspace/content/refine/dialogs/exception_handling.json` — beginner (8 rounds)
- `/workspace/content/refine/dialogs/exception_handling_intermediate.json` — intermediate (8 rounds)
- `/workspace/content/refine/dialogs/exception_handling_advanced.json` — advanced (8 rounds)
- `/workspace/content/refine/dialogs/post_mortem.json` — beginner (8 rounds)
- `/workspace/content/refine/dialogs/post_mortem_intermediate.json` — intermediate (8 rounds)
- `/workspace/content/refine/dialogs/post_mortem_advanced.json` — advanced (8 rounds)

### Vocabulary
- `/workspace/content/refine/vocabulary.json` — 76 entries across 4 categories
  - shirt_production: 30 entries (tech pack, BOM, marker, SPI, fusible interlining, AQL, etc.)
  - order_management: 16 entries (Proforma Invoice, TT/LC/DP/DA, ETD/ETA, B/L, OEM/ODM, etc.)
  - exception_handling: 15 entries (force majeure, rework, credit note, 8D, CAPA, etc.)
  - post_mortem: 15 entries (5-why, fishbone, Pareto, SOP, PDCA, Kaizen, COPQ, etc.)

### System prompts
- `/workspace/content/refine/system_prompts.json` — 3 difficulty levels (beginner / intermediate / advanced) with `{{scenario_title}}` placeholder

### Plan deliverable
- `/workspace/.mavis/plans/plan_7da02a8f/outputs/refinement-batch1/deliverable.md` — this file (copy in plan outputs)

## Notes for the verifier

### 4 Scenarios — content focus
1. **shirt_production** — full woven-shirt workflow: fabric 4-point inspection → marker/spreading → cutting → sewing (one piece flow, SPI, fusing, buttonhole, flat-felled seam) → ironing (pressing cloth) → AQL 1.5/2.5/4.0 → polybag + master carton + shipping mark. AI is the production manager / IE engineer; user is the merchandiser or QA.
2. **order_management** — order lifecycle: PI, TT 30/70 (and LC at sight), ETD/ETA, cut-off, B/L, FTA cert, OEM vs ODM, weekly call cadence. AI is the buyer; user is the export sales rep.
3. **exception_handling** — emergency handling: fabric dye lot failure, bar tack defect, port strike (force majeure), 5-why + 8D + CAPA, credit note, Plan B, split shipment, air-freight cost share. AI is the buyer or QC under pressure; user is the merchandiser or export manager.
4. **post_mortem** — closing review: 5-why + fishbone + CAPA register, lessons learned, SOP update with PDCA, KPI scorecard, RACI, COPQ, QBR cadence. AI is the factory management / quality manager; user is the project manager reporting up.

### Difficulty progression
- **Beginner** — 8 rounds, short sentences (10-15 words), terms defined on first use, single-question turns.
- **Intermediate** — 8 rounds, normal business English (15-25 word sentences), trade terms used without redefinition, push for numbers/dates/owners.
- **Advanced** — 8 rounds, native-fluent hedging + idioms (20-35 word sentences), full jargon, RACI, side letters, 30/60/90-day verification, negotiation tactics.

### Industry terms used accurately
Verified all technical terms against standard garment-export usage:
- Shirt: SPI, AQL 1.5/2.5/4.0, 4-point system, GSM, Delta E, marker efficiency, plies, fusing, fusible interlining, peel strength, pressing cloth, iron shine, flat-felled seam, French seam, buttonhole (flat), bar tack, polybag, shipping mark, master carton, DUPRO, PSI.
- Order: Proforma Invoice, Sales Contract, PO, TT, LC at sight, DP, DA, deposit, balance, ETD, ETA, booking, cut-off, B/L, FTA Certificate of Origin (vs Form A — flagged the difference in the dialog), OEM, ODM, weekly call.
- Exception: force majeure, expedite, rework, replacement, scrap, credit note, debit note, claim, 8D report, root cause, corrective action, preventive action, CAPA, production delay.
- Post-mortem: 5-why analysis, fishbone (6M), Pareto, lessons learned, SOP, work instruction, PDCA, Kaizen, COPQ, yield rate, defect rate, KPI review.

### Quality safeguards observed
- Wrote one file at a time, each < 11 KB (well under the 5 KB soft target when used the recommended strategy, but kept all JSON parseable on first try).
- Used safer language for sensitive issues: "rework" / "repaired" instead of "scrapped all", "shipping schedule revised" instead of "shipment delay", "claim" framed as "credit note / goodwill" first, "force majeure" properly defined and limited to natural disasters.
- All English is natural, no Chinglish, no literal translations.
- All rounds include `ai_message`, `ai_message_zh`, `expected_user_response_hint`, `key_phrases`, `common_mistakes`, `tips_zh`, `user_response_example` — matching the existing schema.

### Files NOT modified
- `/workspace/backend/` — unchanged
- `/workspace/frontend/` — unchanged
- `/workspace/content/process/`, `/workspace/content/scenarios.json`, etc. — unchanged (refine is a sibling directory)
- The 4 new scenarios have IDs (`shirt_production`, `order_management`, `exception_handling`, `post_mortem`) that do not collide with the 6 existing `process/` scenarios.

### How the backend picks them up
The new files live under `/workspace/content/refine/`, parallel to `/workspace/content/process/`. If the backend currently reads from a single `content/` root, the new files will be picked up via the same loaders. If the backend looks for scenarios only in the existing `scenarios.json` file, a small backend config change (or symlink) will be needed to load the refine subdirectory. Worth a 5-minute sanity check on the backend loader before declaring the task fully wired.
