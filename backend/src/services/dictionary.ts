import * as fs from 'node:fs';
import * as path from 'node:path';
import { chatCompletion } from './minimax-llm';
import { createLogger } from '../utils/logger';

const log = createLogger('dictionary');

/**
 * Word-lookup service.
 *
 * Tiered lookup:
 *   1. Local dictionary (the same JSON the frontend uses) — instant, no cost.
 *   2. MiniMax LLM fallback with strict JSON schema — for any word not in the
 *      local dictionary, with a 1.5 s hard timeout so the UI stays snappy.
 *   3. If the LLM call also fails (no key, network, parse error), return a
 *      `mock` source with a placeholder Chinese meaning.
 *
 * The same fuzzy-matching rules as the frontend (plural / -ed / -ing / -ly
 * stem) are applied locally so the lookup surface stays consistent.
 */

let _dict: Record<string, string[]> | null = null;

function loadDict(): Record<string, string[]> {
  if (_dict) return _dict;
  try {
    // Read the same JSON the frontend uses, so the two stay in lockstep.
    // File layout: backend/src/services/dictionary.ts  →  up to backend/
    // →  up to project root →  frontend/src/data/garment-textile-dict.json
    // (i.e. 3 hops up from __dirname, then into the frontend dir).
    const dictPath = path.resolve(
      __dirname,
      '../../../frontend/src/data/garment-textile-dict.json',
    );
    const raw = JSON.parse(fs.readFileSync(dictPath, 'utf-8')) as Record<string, unknown>;
    _dict = Object.fromEntries(
      Object.entries(raw).filter(([k]) => !k.startsWith('_')),
    ) as Record<string, string[]>;
    log.info(`Loaded ${Object.keys(_dict).length} dictionary entries`);
  } catch (err) {
    log.warn(`Failed to load dictionary: ${(err as Error).message}`);
    _dict = {};
  }
  return _dict;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupLocal(raw: string): { key: string; meaning_zh: string } | null {
  const norm = normalize(raw);
  if (!norm || norm.length > 24) return null;
  if (/^\d+(\.\d+)?$/.test(norm)) return null;
  const d = loadDict();

  // 1) exact
  if (d[norm]) return { key: norm, meaning_zh: d[norm].join(' · ') };

  // 2) plural / -s / -es / -ies
  if (norm.endsWith('ies') && norm.length > 4) {
    const sg = norm.slice(0, -3) + 'y';
    if (d[sg]) return { key: sg, meaning_zh: d[sg].join(' · ') };
  }
  if (norm.endsWith('es') && norm.length > 4) {
    const sg = norm.slice(0, -2);
    if (d[sg]) return { key: sg, meaning_zh: d[sg].join(' · ') };
  }
  if (norm.endsWith('s') && norm.length > 3 && !norm.endsWith('ss')) {
    const sg = norm.slice(0, -1);
    if (d[sg]) return { key: sg, meaning_zh: d[sg].join(' · ') };
  }

  // 3) -ed
  if (norm.endsWith('ed') && norm.length > 4) {
    for (const c of [norm.slice(0, -2), norm.slice(0, -1)]) {
      if (d[c]) return { key: c, meaning_zh: d[c].join(' · ') };
    }
  }

  // 4) -ing
  if (norm.endsWith('ing') && norm.length > 5) {
    for (const c of [norm.slice(0, -3), norm.slice(0, -3) + 'e']) {
      if (d[c]) return { key: c, meaning_zh: d[c].join(' · ') };
    }
  }

  // 5) -ly
  if (norm.endsWith('ly') && norm.length > 4) {
    const stem = norm.slice(0, -2);
    if (d[stem]) return { key: stem, meaning_zh: d[stem].join(' · ') };
  }

  return null;
}

const DICTIONARY_SYSTEM_PROMPT = `You are a concise English-Chinese dictionary for the apparel & textile export industry.

CRITICAL OUTPUT FORMAT — READ FIRST:
- Respond with ONLY a single valid JSON object. Nothing else.
- The FIRST character of your response must be { and the LAST character must be }.
- DO NOT wrap the JSON in markdown fences (no \`\`\`json or \`\`\`).
- DO NOT add any explanation, preamble, commentary, or prose before or after the JSON.

The response must have EXACTLY this shape (no extra fields, no markdown):
{
  "word": "the English word/phrase as given (lowercase, no punctuation)",
  "meaning_zh": "concise Chinese meaning, max 30 characters, no English, no quotes"
}

If the input is a real English word, give the most common apparel / textile / trade-finance relevant meaning (e.g. "consolidate" → "并柜/拼柜"; "tariff" → "关税").
If you don't recognize the word at all, return: {"word": "<input>", "meaning_zh": "暂无释义"}.

REMINDER: Your entire response must be a single JSON object starting with { and ending with }. No markdown, no fences, no prose.`;

const TIMEOUT_MS = 1500;

export async function lookupWord(
  raw: string,
): Promise<{ word: string; meaning_zh: string; source: 'local' | 'llm' | 'mock' }> {
  // Tier 1: local dictionary
  const local = lookupLocal(raw);
  if (local) {
    return { word: local.key, meaning_zh: local.meaning_zh, source: 'local' };
  }

  // Tier 2: LLM fallback with hard 1.5s timeout (UI must stay snappy).
  const llmPromise = chatCompletion({
    system: DICTIONARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Look up: "${normalize(raw)}"` }],
    temperature: 0.2,
    maxTokens: 80,
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('LLM lookup timeout')), TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([llmPromise, timeoutPromise]);
    // chatCompletion always returns a `content` string (mock fallback included).
    const cleaned = res.content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    let parsed: { word?: unknown; meaning_zh?: unknown };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      log.warn(`LLM returned non-JSON: ${cleaned.slice(0, 100)}`);
      return { word: normalize(raw), meaning_zh: '暂无释义', source: 'mock' };
    }
    const word = typeof parsed.word === 'string' ? parsed.word : normalize(raw);
    const meaning_zh =
      typeof parsed.meaning_zh === 'string' && parsed.meaning_zh.trim()
        ? parsed.meaning_zh.trim().slice(0, 60)
        : '暂无释义';
    return { word, meaning_zh, source: res.mocked ? 'mock' : 'llm' };
  } catch (err) {
    log.warn(`Dictionary LLM fallback failed: ${(err as Error).message}`);
    return { word: normalize(raw), meaning_zh: '暂无释义', source: 'mock' };
  }
}
