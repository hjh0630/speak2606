/**
 * Word-lookup service (Workers version).
 *
 * Same tiered lookup as backend:
 *   1. Local dictionary (bundled JSON, same source the frontend uses)
 *   2. MiniMax LLM fallback with 1.5s hard timeout
 *   3. Mock placeholder if both fail
 *
 * Workers differences:
 *   - Dictionary JSON imported at build time (no fs)
 *   - chatCompletion takes MiniMaxEnv arg
 */
// Dictionary JSON is copied into the workers project tree at build time.
// @ts-ignore — esbuild resolves this as a JSON module.
import dictJson from '../../data/garment-textile-dict.json';
import { chatCompletion } from './llm';
import { createLogger } from '../utils/logger';
import type { MiniMaxEnv } from '../env';

const log = createLogger('dictionary');

let _dict: Record<string, string[]> | null = null;

function loadDict(): Record<string, string[]> {
  if (_dict) return _dict;
  // TS resolveJsonModule turns the JSON into a typed object at build time.
  const raw = dictJson as Record<string, unknown>;
  _dict = Object.fromEntries(
    Object.entries(raw).filter(([k]) => !k.startsWith('_')),
  ) as Record<string, string[]>;
  log.info(`Loaded ${Object.keys(_dict).length} dictionary entries`);
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

  if (d[norm]) return { key: norm, meaning_zh: d[norm].join(' · ') };

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
  if (norm.endsWith('ed') && norm.length > 4) {
    for (const c of [norm.slice(0, -2), norm.slice(0, -1)]) {
      if (d[c]) return { key: c, meaning_zh: d[c].join(' · ') };
    }
  }
  if (norm.endsWith('ing') && norm.length > 5) {
    for (const c of [norm.slice(0, -3), norm.slice(0, -3) + 'e']) {
      if (d[c]) return { key: c, meaning_zh: d[c].join(' · ') };
    }
  }
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
  mm: MiniMaxEnv,
  raw: string,
): Promise<{ word: string; meaning_zh: string; source: 'local' | 'llm' | 'mock' }> {
  const local = lookupLocal(raw);
  if (local) {
    return { word: local.key, meaning_zh: local.meaning_zh, source: 'local' };
  }

  const llmPromise = chatCompletion(mm, {
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
    const cleaned = res.content.replace(/```json/gi, '').replace(/```/g, '').trim();
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
