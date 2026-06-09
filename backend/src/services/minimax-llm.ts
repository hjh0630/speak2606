import { config } from '../config';
import { createLogger } from '../utils/logger';
import type { LlmChatRequest, LlmChatResponse, ScoreFeedback } from '../types';

const log = createLogger('minimax-llm');

/**
 * MiniMax text chat completion client (chatcompletion_v2, OpenAI-compatible).
 * When credentials are missing, returns deterministic mock data so the rest of the stack
 * (scoring, conversation) can be exercised end-to-end during local dev.
 *
 * Endpoint: POST {API_BASE}/v1/text/chatcompletion_v2
 * Auth:     Authorization: Bearer <MINIMAX_API_KEY>
 * Headers:  X-Group-Id: <MINIMAX_GROUP_ID>   (some endpoints require this)
 */

const SCORING_SYSTEM_PROMPT = `You are a friendly but rigorous English speaking coach for a Chinese export salesperson in the apparel & textile industry.

CRITICAL OUTPUT FORMAT — READ FIRST:
- Respond with ONLY a single valid JSON object. Nothing else.
- The FIRST character of your response must be { and the LAST character must be }.
- DO NOT wrap the JSON in markdown fences (no \`\`\`json or \`\`\`).
- DO NOT add any explanation, preamble, commentary, or prose before or after the JSON.
- DO NOT include any text outside the JSON object.
- The response must be parseable by JSON.parse() with zero preprocessing.
- If you violate this format, the system fails. JSON-only, always.

After each user utterance, evaluate it and return STRICT JSON with EXACTLY this shape (no prose, no markdown, no backticks):

{
  "overall_score": number,         // 0-100 integer
  "fluency": number,               // 0-100 integer
  "accuracy": number,              // 0-100 integer — grammar, vocabulary, collocation
  "key_issues": [string, string, string],  // up to 3 short English issue sentences (max 12 words each)
  "suggestion": string             // one English sentence of constructive advice (max 20 words)
}

Scoring rubric:
- 90-100: native-like, natural business English, no errors
- 75-89:  solid business English, minor slips
- 60-74:  understandable but noticeable grammar / word-choice issues
- 40-59:  frequent errors that may cause confusion
- 0-39:   hard to follow

Be honest, brief, and actionable. ALWAYS output valid JSON. Never wrap in markdown.

REMINDER: Your entire response must be a single JSON object starting with { and ending with }. No markdown, no fences, no prose outside the JSON. The first character is { and the last character is }.`;

function buildMockLlmResponse(req: LlmChatRequest): LlmChatResponse {
  // For scoring requests, return a mock score.
  if (req.responseFormatJson && req.system.includes('"overall_score"')) {
    const mockScore: ScoreFeedback = {
      overall_score: 78,
      fluency: 80,
      accuracy: 76,
      key_issues: [
        'Mind the article usage: "I am sales manager" needs "a sales manager".',
        'Use past simple for completed actions, not present perfect.',
        'Watch the preposition: "interested for" should be "interested in".',
      ],
      suggestion: 'Read the sentence aloud once before sending; small prepositions often slip.',
    };
    return {
      content: JSON.stringify(mockScore),
      model: 'mock-minimax',
      mocked: true,
    };
  }
  // Otherwise echo a short helpful reply.
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
  const userText = lastUser?.content ?? '';
  const reply = userText
    ? `(mock AI) I hear you — you said: "${userText.slice(0, 80)}". Let's continue.`
    : '(mock AI) Hello, how can I help you today?';
  return {
    content: reply,
    model: 'mock-minimax',
    mocked: true,
  };
}

function buildRequestBody(req: LlmChatRequest): unknown {
  // OpenAI-compatible message format. We prepend the system message into the messages array.
  const messages = [
    { role: 'system' as const, content: req.system },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const body: Record<string, unknown> = {
    model: 'minimax-text-01',
    messages,
    temperature: req.temperature ?? 0.7,
  };
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  // NOTE: We deliberately do NOT set `response_format: { type: "json_object" }`.
  // The MiniMax text-01 model returns an empty string when this field is set,
  // even though the API is OpenAI-compatible. We rely on a strict system prompt
  // + the safeParseScore fence-stripping on the client side instead.
  return body;
}

async function callRemote(req: LlmChatRequest): Promise<LlmChatResponse> {
  const url = `${config.minimax.apiBase.replace(/\/$/, '')}/v1/text/chatcompletion_v2`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.minimax.apiKey}`,
  };
  if (config.minimax.groupId) {
    headers['X-Group-Id'] = config.minimax.groupId;
  }

  const requestBody = buildRequestBody(req);
  log.debug(`MiniMax LLM request: responseFormatJson=${req.responseFormatJson} body=${JSON.stringify(requestBody).slice(0, 400)}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`MiniMax LLM HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    log.debug(`MiniMax LLM response: len=${content.length} raw=${JSON.stringify(content).slice(0, 300)}`);
    return {
      content,
      model: data.model ?? 'unknown',
      mocked: false,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatCompletion(req: LlmChatRequest): Promise<LlmChatResponse> {
  if (!config.minimax.hasCredentials) {
    log.debug('No credentials, returning mock LLM response');
    return buildMockLlmResponse(req);
  }
  try {
    return await callRemote(req);
  } catch (err) {
    log.warn(`MiniMax LLM call failed, falling back to mock: ${(err as Error).message}`);
    const mock = buildMockLlmResponse(req);
    return { ...mock, content: mock.content + ' [fallback]' };
  }
}

export function buildScoringSystemPrompt(): string {
  return SCORING_SYSTEM_PROMPT;
}

export function buildConversationSystemPrompt(scenarioSystemPrompt: string): string {
  return `${scenarioSystemPrompt}

After the dialogue section, the user may request end-of-session feedback. When that happens, also return STRICT JSON with the exact same scoring shape as the scoring system prompt.`;
}
