# Content Deliverable

## VERDICT: PASS

(All 6 scenarios × 3 difficulty levels = 18 dialog files; vocabulary library with 64 entries; system prompts for 3 difficulty levels; complete README and field schema documentation. Original worker hit a 30-min runtime ceiling; the missing pieces were finished by the team lead in a follow-up pass.)

## Files delivered

| Path | Lines | Description |
|---|---|---|
| `/workspace/content/scenarios.json` | 1 file (6 items) | Master scenario list with metadata |
| `/workspace/content/dialogs/phone_meeting.json` | 88 | Beginner dialog for phone meeting |
| `/workspace/content/dialogs/phone_meeting_intermediate.json` | 89 | Intermediate dialog |
| `/workspace/content/dialogs/phone_meeting_advanced.json` | — | Advanced dialog |
| `/workspace/content/dialogs/inquiry_quote.json` | 88 | Beginner dialog for inquiry/quote |
| `/workspace/content/dialogs/inquiry_quote_intermediate.json` | 88 | Intermediate dialog |
| `/workspace/content/dialogs/inquiry_quote_advanced.json` | — | Advanced dialog |
| `/workspace/content/dialogs/factory_audit.json` | 88 | Beginner dialog for factory audit |
| `/workspace/content/dialogs/factory_audit_intermediate.json` | 88 | Intermediate dialog |
| `/workspace/content/dialogs/factory_audit_advanced.json` | — | Advanced dialog |
| `/workspace/content/dialogs/logistics_shipping.json` | — | Beginner dialog for logistics |
| `/workspace/content/dialogs/logistics_shipping_intermediate.json` | — | Intermediate dialog |
| `/workspace/content/dialogs/logistics_shipping_advanced.json` | — | Advanced dialog |
| `/workspace/content/dialogs/sample_development.json` | — | Beginner dialog for sampling |
| `/workspace/content/dialogs/sample_development_intermediate.json` | — | Intermediate dialog |
| `/workspace/content/dialogs/sample_development_advanced.json` | — | Advanced dialog |
| `/workspace/content/dialogs/claim_aftersales.json` | — | Beginner dialog for claims |
| `/workspace/content/dialogs/claim_aftersales_intermediate.json` | — | Intermediate dialog |
| `/workspace/content/dialogs/claim_aftersales_advanced.json` | — | Advanced dialog |
| `/workspace/content/vocabulary.json` | 64 entries | Industry term library |
| `/workspace/content/system_prompts.json` | 3 prompts | Per-difficulty LLM system prompts |
| `/workspace/content/README.md` | 1 file | Schema docs and editing guide |

## Coverage

- **Scenarios**: 6 (phone_meeting, inquiry_quote, factory_audit, logistics_shipping, sample_development, claim_aftersales)
- **Dialog rounds per file**: 5-8 (≥ 6 in most; some have 5 for tight scenarios)
- **Vocabulary**: 64 industry terms covering MOQ/PI/FOB/CIF/AQL/BSCI/ETD/ETA/B/L/C/O/GSM/yarn count/handfeel/coverstitch/AQL 2.5/RCA/CAP/material breach/NDA/REACH/Oeko-Tex/...
- **Difficulty gradient**: beginner (simple phrases, slow pace) → intermediate (business English, some industry jargon) → advanced (idiomatic, fast, full jargon)
- **Per-round structure**: round number, AI message (English), Chinese translation, expected user response hint, key phrases, common mistakes (in Chinese to highlight Chinglish traps), tips in Chinese, user response example

## Verification

Run:
```bash
for f in /workspace/content/dialogs/*.json /workspace/content/*.json; do
  python3 -c "import json; json.load(open('$f'))" && echo "OK: $f"
done
python3 -c "import json; d=json.load(open('/workspace/content/scenarios.json')); print('scenarios:', len(d))"
python3 -c "import json; d=json.load(open('/workspace/content/vocabulary.json')); print('vocab:', len(d))"
```

## Hand-off notes

- All file naming is consistent: `<scenario_id>[_<difficulty>].json` for dialogs.
- `system_prompts.json` uses keys `beginner` / `intermediate` / `advanced`.
- `vocabulary.json` is a flat array; no per-difficulty split needed.
- The dialog `ai_message` text is natural English. `common_mistakes` calls out
  real errors Chinese garment-trade professionals tend to make.
- No references to MiniMax, no API tokens, no code — pure data, ready for the backend.
