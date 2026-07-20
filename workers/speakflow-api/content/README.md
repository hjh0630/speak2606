# Speakly — Content Data

This directory holds the static content that drives the English speaking practice app.
The backend reads these files at startup; no database migrations are needed for the
content layer.

## File map

| File | What it is | Format |
|---|---|---|
| `scenarios.json` | Master list of all practice scenarios with metadata | JSON array |
| `dialogs/<scenario_id>.json` | Dialog script for the default (beginner) difficulty | JSON |
| `dialogs/<scenario_id>_intermediate.json` | Dialog script for intermediate difficulty | JSON |
| `dialogs/<scenario_id>_advanced.json` | Dialog script for advanced difficulty | JSON |
| `vocabulary.json` | Industry-specific vocabulary list (with phonetic, definition, example) | JSON array |
| `system_prompts.json` | Three system prompts (one per difficulty) used to seed the LLM | JSON |

## Scenarios

There are 6 scenarios, each with 3 difficulty levels (18 dialog files total):

| ID | Title (zh) | Title (en) |
|---|---|---|
| `phone_meeting` | 电话会议 | Phone Meeting |
| `inquiry_quote` | 询盘报价 | Inquiry & Quotation |
| `factory_audit` | 工厂参观/验厂 | Factory Visit & Audit |
| `logistics_shipping` | 物流/船期/单证 | Logistics, Shipping & Documents |
| `sample_development` | 款式开发/打样 | Sample Development |
| `claim_aftersales` | 索赔/售后 | Claims & After-sales |

## Schemas

### `scenarios.json` (array of objects)
```json
{
  "id": "phone_meeting",
  "title_zh": "电话会议",
  "title_en": "Phone Meeting",
  "icon": "📞",
  "description_zh": "与海外客户初次/跟进通话",
  "description_en": "Initial or follow-up call with overseas buyers",
  "category": "communication",
  "subcategory": "garment_textile",
  "difficulty_levels": ["beginner", "intermediate", "advanced"],
  "ai_role": "Overseas buyer / sourcing manager",
  "ai_role_zh": "海外采购商 / 客户",
  "user_role": "Chinese export sales representative (garment & textile)",
  "user_role_zh": "中国外贸业务员(服装纺织)",
  "key_skills": ["opening the call", "introducing the company", "presenting samples"],
  "key_skills_zh": ["开场白", "公司介绍", "样品与产能推介"],
  "industry_terms_sample": ["MOQ", "lead time", "handfeel"],
  "estimated_minutes": 8,
  "tags": ["voice", "sales"]
}
```

### `dialogs/<id>.json`
```json
{
  "scenario_id": "phone_meeting",
  "scenario_title_en": "Phone Meeting",
  "scenario_title_zh": "电话会议",
  "difficulty": "beginner",
  "rounds": [
    {
      "round": 1,
      "ai_message": "Hello, this is Mark from ABC Trading. May I speak with Mr. Chen?",
      "ai_message_zh": "你好,我是 ABC Trading 的 Mark,请问陈先生在吗?",
      "expected_user_response_hint": "自我介绍并询问来意",
      "key_phrases": ["This is ...", "May I speak with ..."],
      "common_mistakes": "不要在 This is Mark speaking 后面加 I am",
      "tips_zh": "接电话先报公司+姓名",
      "user_response_example": "Hello, this is Chen Wei from Lily Garments. Speaking, please."
    }
  ]
}
```

### `vocabulary.json` (array of objects)
```json
{
  "term": "MOQ",
  "full_form": "Minimum Order Quantity",
  "category": "phone_meeting",
  "phonetic": "/ˌem əʊ ˈkjuː/",
  "definition_en": "the smallest quantity a supplier is willing to produce per order",
  "definition_zh": "最低起订量",
  "example": "Our MOQ for this style is 500 pieces per color."
}
```

### `system_prompts.json`
```json
{
  "_doc": "Three difficulty levels for system prompts that drive the LLM roleplay.",
  "beginner": "You are roleplaying an overseas buyer calling a Chinese garment exporter. ...",
  "intermediate": "...",
  "advanced": "..."
}
```

## How the backend uses this

- The backend reads `scenarios.json` on startup and exposes them via `GET /api/scenarios`.
- When a user starts a session, the backend looks up the matching dialog file
  (`<scenario_id>[_<difficulty>].json`) and uses it to seed the LLM context.
- The system_prompts.json `beginner` / `intermediate` / `advanced` keys are merged
  with the dialog to create the full system prompt for that conversation.
- `vocabulary.json` is available for the frontend vocabulary list view.

## Editing

You can hand-edit any JSON file. The backend picks up changes on restart. If you add a
new scenario, you must:
1. Add an entry to `scenarios.json`
2. Create `dialogs/<id>.json`, `dialogs/<id>_intermediate.json`, `dialogs/<id>_advanced.json`
3. Add new vocabulary entries (optional but recommended)

## Quality guidelines

- All `ai_message` text must be natural English, not Chinglish.
- Industry terms must be accurate for garment & textile export business.
- Each dialog should have 5-8 rounds; each round is one exchange.
- `key_phrases` should be phrases the user can actually reuse in their real work.
- `common_mistakes` should call out real errors Chinese learners make, not made-up ones.
