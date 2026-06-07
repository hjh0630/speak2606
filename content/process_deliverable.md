# 工艺沟通场景内容交付清单

## 6 个场景(每个 × 3 难度 × 6+ 轮对话 = 18 个对话文件)

| ID | 中文 | 英文 | 文件数 |
|----|------|------|-------|
| yarn_sourcing | 纱线采购 | Yarn Sourcing | 3 (b/i/a) |
| weaving_knitting | 织造沟通 | Weaving & Knitting | 3 |
| dyeing_finishing | 染整工艺 | Dyeing & Finishing | 3 |
| printing_embroidery | 印绣花工艺 | Printing & Embroidery | 3 |
| seamless_garment | 无缝服装 | Seamless Garment | 3 |
| quality_tech_issue | 工艺问题解决 | Quality & Tech Issue | 3 |

## 文件清单

- `scenarios.json` — 6 个场景元数据
- `dialogs/{scenario_id}.json` — 18 个对话脚本(每场景 3 难度)
- `vocabulary.json` — **80 个工艺术语**
- `system_prompts.json` — 3 难度英文 system prompt

## 工艺术语覆盖

- 纱线:yarn count (Ne/Nm/Tex), twist, composition, carded, combed, siro-spun, OE, ring-spun, vortex, slub, melange, heather
- 织造:GSM, EPI, PPI, courses, wales, gauge, jacquard, dobby, plain weave, twill, satin, single jersey, interlock, rib, pique, fleece, terry
- 染整:color fastness, shrinkage, hand feel, GSM loss, pre-shrunk, mercerized, singed, bleached, reactive dye, disperse dye, sublimation
- 印绣花:digital print, rotary screen, flat screen, registration, sublimation, satin stitch, chain stitch, toweling, sequin, eyelet, applique
- 无缝:seamless knitting, tubular, spandex, elastane, Lycra, denier, gauge E28, body shaping
- 问题:barry / barre, skew, pilling, snagging, contamination, off-shade, neps, slubs, misprint, broken needle
