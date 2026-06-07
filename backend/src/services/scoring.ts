import { chatCompletion, buildScoringSystemPrompt } from './minimax-llm';
import { createLogger } from '../utils/logger';
import type { LlmChatMessage, ScoreFeedback } from '../types';

const log = createLogger('scoring');

/**
 * Scoring service.
 *
 *  - Free mode:  LLM returns a JSON ScoreFeedback (overall, fluency, accuracy, key_issues, suggestion).
 *  - Repeat mode: we do a deterministic string-similarity + keyword-hit comparison
 *                 against the target sentence; no LLM roundtrip.
 *
 * The LLM system prompt STRICTLY requires valid JSON. We still defend against bad output
 * (markdown fences, prose) by stripping common artefacts before JSON.parse.
 */

const FALLBACK: ScoreFeedback = {
  overall_score: 70,
  fluency: 70,
  accuracy: 70,
  key_issues: ['No major issues detected.'],
  suggestion: 'Keep practicing with native speakers to improve fluency.',
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function safeParseScore(raw: string): ScoreFeedback | null {
  if (!raw) return null;
  // Strip ```json ... ``` fences if the LLM wrapped the JSON.
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  // Find first '{' and last '}' in case of leading/trailing prose.
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const issuesRaw = obj.key_issues;
    const issues: string[] = Array.isArray(issuesRaw)
      ? issuesRaw.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : [];
    return {
      overall_score: clamp(Number(obj.overall_score ?? 0), 0, 100),
      fluency: clamp(Number(obj.fluency ?? 0), 0, 100),
      accuracy: clamp(Number(obj.accuracy ?? 0), 0, 100),
      key_issues: issues.length > 0 ? issues : FALLBACK.key_issues,
      suggestion: typeof obj.suggestion === 'string' ? obj.suggestion : FALLBACK.suggestion,
    };
  } catch {
    return null;
  }
}

export async function scoreWithLlm(
  userUtterance: string,
  contextMessages: LlmChatMessage[],
): Promise<ScoreFeedback> {
  const messages: LlmChatMessage[] = [
    ...contextMessages.slice(-6), // keep the prompt bounded
    { role: 'user', content: userUtterance },
  ];
  try {
    const resp = await chatCompletion({
      system: buildScoringSystemPrompt(),
      messages,
      temperature: 0.3,
      maxTokens: 400,
      responseFormatJson: true,
    });
    const parsed = safeParseScore(resp.content);
    if (parsed) {
      return parsed;
    }
    log.warn(`LLM score JSON unparseable, using fallback. raw=${resp.content.slice(0, 120)}`);
    return FALLBACK;
  } catch (err) {
    log.warn(`scoreWithLlm failed: ${(err as Error).message}`);
    return FALLBACK;
  }
}

function normaliseForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normaliseForCompare(s).split(' ').filter((t) => t.length > 0));
}

/**
 * Jaccard similarity over word tokens. Cheap, deterministic, no NLP deps.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  if (aSet.size === 0 && bSet.size === 0) return 1;
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  for (const t of aSet) if (bSet.has(t)) inter++;
  const uni = aSet.size + bSet.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

/**
 * Repeat-mode scoring: compare user ASR text against the target sentence.
 * Returns an overall_score, fluency (jaccard), accuracy (jaccard) and short feedback.
 */
export function scoreRepeat(target: string, userText: string): ScoreFeedback {
  if (!userText || !userText.trim()) {
    return {
      overall_score: 0,
      fluency: 0,
      accuracy: 0,
      key_issues: ['No speech detected. Please try again and speak clearly.'],
      suggestion: 'Press the record button and speak the sentence once more.',
    };
  }
  const sim = jaccardSimilarity(target, userText); // 0..1
  const overall = Math.round(sim * 100);
  const fluency = Math.round(sim * 100);
  const accuracy = Math.round(sim * 100);

  // Surface up to 3 key differences: words in target missing from user, and vice versa.
  const targetTokens = tokenSet(target);
  const userTokens = tokenSet(userText);
  const missing: string[] = [];
  for (const t of targetTokens) if (!userTokens.has(t)) missing.push(t);
  const extra: string[] = [];
  for (const t of userTokens) if (!targetTokens.has(t)) extra.push(t);

  const keyIssues: string[] = [];
  if (missing.length > 0) {
    keyIssues.push(`Missing words: ${missing.slice(0, 5).join(', ')}.`);
  }
  if (extra.length > 0) {
    keyIssues.push(`Extra / wrong words: ${extra.slice(0, 5).join(', ')}.`);
  }
  if (sim < 0.5) {
    keyIssues.push('Try to match the target sentence word-for-word first.');
  }
  if (keyIssues.length === 0) {
    keyIssues.push('Nice match — try saying it once more with smoother rhythm.');
  }
  if (keyIssues.length > 3) keyIssues.length = 3;

  let suggestion: string;
  if (overall >= 90) suggestion = 'Excellent match — focus on natural rhythm and intonation next.';
  else if (overall >= 70) suggestion = 'Good — listen to the target once more and repeat with clearer word boundaries.';
  else if (overall >= 40) suggestion = 'Re-listen to the target sentence and emphasise the content words.';
  else suggestion = 'Re-play the target sentence, then repeat slowly word by word.';

  return {
    overall_score: clamp(overall, 0, 100),
    fluency: clamp(fluency, 0, 100),
    accuracy: clamp(accuracy, 0, 100),
    key_issues: keyIssues,
    suggestion,
  };
}
