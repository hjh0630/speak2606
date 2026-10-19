/**
 * POST /api/custom-scenarios/generate (Workers version).
 *
 * Mirrors backend/src/routes/custom-scenarios.ts. Differences:
 * - Hono instead of Fastify.
 * - MiniMax credentials come from env bindings (getMiniMaxEnv), not config.ts.
 * - chatCompletion(mm, req) takes the env as its first argument.
 */
import { Hono } from 'hono';
import { chatCompletion } from '../services/llm';
import { getMiniMaxEnv, hasMiniMaxCredentials, type Bindings } from '../env';
import { createLogger } from '../utils/logger';
import type {
  ApiErrorBody,
  CustomDialogRound,
  CustomScenario,
  CustomVocabularyEntry,
} from '../types';

const log = createLogger('routes/custom-scenarios');

export const customScenariosRoutes = new Hono<{ Bindings: Bindings }>();

function errBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, details } };
}

const GENERATE_SYSTEM_PROMPT = `You are an expert curriculum designer for apparel & textile export-trade English training (服装纺织外贸英语).

Given a scenario NAME and a list of KEYWORDS provided by the user, generate a complete speaking-practice scenario as a SINGLE strict JSON object. No markdown fences, no commentary, nothing outside the JSON. The first character of your response must be { and the last must be }.

JSON shape (all fields required):

{
  "title_zh": "场景中文标题",
  "title_en": "English scenario title",
  "description_zh": "一两句中文场景描述",
  "description_en": "One or two English sentences describing the scenario",
  "vocabulary": [
    {
      "term": "shrinkage",
      "full_form": "(optional, for abbreviations)",
      "phonetic": "/ˈʃrɪŋkɪdʒ/",
      "definition_en": "short English definition",
      "definition_zh": "中文释义",
      "example": "short example sentence in trade context"
    }
  ],
  "dialogs": {
    "beginner":     [ /* exactly 6 rounds */ ],
    "intermediate": [ /* exactly 6 rounds */ ],
    "advanced":     [ /* exactly 6 rounds */ ]
  },
  "system_prompt": "English role-play persona for the dialogue AI: you play the OTHER party (e.g. the overseas buyer / QC inspector) in this scenario. Describe tone, sentence length, industry jargon, and how to push the conversation forward."
}

Each dialog round has EXACTLY this shape:
{
  "round": 1,
  "ai_message": "what the AI (the buyer / inspector) says",
  "ai_message_zh": "上一句的中文翻译",
  "expected_user_response_hint": "中文提示用户该回应什么",
  "key_phrases": ["useful phrase 1", "useful phrase 2"],
  "common_mistakes": "常见中式英语或语法错误提示",
  "tips_zh": "中文小贴士",
  "user_response_example": "an example good answer the user could give"
}

Rules:
- vocabulary: 8-12 entries and MUST cover every keyword the user supplied (each keyword appears as a term or inside a full_form/definition).
- beginner rounds: short, simple sentences. intermediate: natural business English. advanced: idiomatic, jargon-heavy, push back harder.
- Industry context is apparel & textile foreign trade (MOQ, FOB/CIF, lead time, handfeel, GSM, QC, claim, PI, TT...).
- Output JSON only.`;

function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || Date.now().toString(36);
}

/** Strip markdown fences and trim to the outermost JSON object. */
function extractJson(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('no JSON object found in LLM output');
  }
  return JSON.parse(s.slice(start, end + 1));
}

// Generic textile-trade rounds used by the mock (no-credentials) path.
function mockRounds(name: string, keywords: string[]): CustomDialogRound[] {
  const kw = keywords.join(', ');
  const lines: Array<[string, string, string]> = [
    [
      `Hello, I'm the buyer's QC manager. I'd like to discuss the ${name} with you today.`,
      `你好,我是买方的 QC 经理,今天想和你谈一下${name}。`,
      '打招呼并欢迎对方开始检查',
    ],
    [
      `Let's start with the key points: ${kw}. Can you walk me through your inspection process?`,
      `我们先从几个关键点开始:${kw}。能介绍一下你们的检验流程吗?`,
      '简要说明检验流程,覆盖对方提到的关键词',
    ],
    [
      'What tolerance do you usually accept, and how do you measure it?',
      '你们通常接受多大的公差?怎么测量?',
      '给出具体公差数值和测量方法',
    ],
    [
      'We found a few issues in the last shipment. How will you prevent them this time?',
      '上次出货发现了一些问题,这次你们怎么预防?',
      '承认问题并说明改进措施',
    ],
    [
      'If the goods fail the final inspection, what is your solution?',
      '如果最终检验不合格,你们的解决方案是什么?',
      '提出返修、换货或折扣等方案',
    ],
    [
      "OK, please send me the inspection report and we'll confirm the shipment date.",
      '好的,请把验货报告发我,我们确认船期。',
      '确认会发报告并感谢对方',
    ],
  ];
  return lines.map(([en, zh, hint], i) => ({
    round: i + 1,
    ai_message: en,
    ai_message_zh: zh,
    expected_user_response_hint: hint,
    key_phrases: keywords.slice(0, 3).concat(['quality standard', 'tolerance']),
    common_mistakes: '避免中式直译,如把"我们会改进"说成 "we will change"',
    tips_zh: '先确认对方关注点,再给具体数字,别只说 "no problem"',
    user_response_example: 'Sure, let me explain our standard procedure step by step.',
  }));
}

/** Deterministic scenario used when no MiniMax credentials are configured. */
function buildMockScenario(id: string, name: string, keywords: string[]): CustomScenario {
  const extraTerms: CustomVocabularyEntry[] = [
    { term: 'inspection report', phonetic: '/ɪnˈspekʃən rɪˈpɔːt/', definition_en: 'a written record of quality check results', definition_zh: '验货报告', example: 'We will send the inspection report by Friday.' },
    { term: 'tolerance', phonetic: '/ˈtɒlərəns/', definition_en: 'the allowed variation from a standard', definition_zh: '公差', example: 'The tolerance is plus or minus one percent.' },
    { term: 'AQL', full_form: 'Acceptable Quality Limit', phonetic: '/ˌeɪ kjuː ˈel/', definition_en: 'the maximum percent defective accepted for sampling inspection', definition_zh: '可接受质量限', example: 'We inspect at AQL 2.5 for major defects.' },
    { term: 'bulk production', definition_en: 'mass production after sample approval', definition_zh: '大货生产', example: 'Bulk production starts after the pre-production sample is approved.' },
    { term: 'rework', phonetic: '/ˌriːˈwɜːk/', definition_en: 'fixing defective goods so they meet the standard', definition_zh: '返工', example: 'The factory agreed to rework the defective pieces.' },
    { term: 'final inspection', definition_en: 'the last quality check before shipment', definition_zh: '尾期检验', example: 'The final inspection is booked for next Tuesday.' },
    { term: 'pre-production sample', definition_en: 'a sample made before bulk production for approval', definition_zh: '产前样', example: 'Please approve the pre-production sample this week.' },
    { term: 'carton drop test', definition_en: 'a test to check export carton strength', definition_zh: '摔箱测试', example: 'The cartons must pass the drop test.' },
  ];
  const vocabulary: CustomVocabularyEntry[] = keywords.slice(0, 12).map((kw) => ({
    term: kw,
    phonetic: '',
    definition_en: `trade term used in the "${name}" scenario`,
    definition_zh: `「${name}」场景关键词`,
    example: `We need to double-check the ${kw} before shipment.`,
  }));
  for (const t of extraTerms) {
    if (vocabulary.length >= 8) break;
    vocabulary.push(t);
  }
  const rounds = mockRounds(name, keywords);
  return {
    id,
    name,
    keywords,
    title_zh: `${name}(自定义场景)`,
    title_en: name,
    description_zh: `围绕「${name}」的外贸口语练习,关键词:${keywords.join('、')}`,
    description_en: `Custom speaking practice for "${name}" covering: ${keywords.join(', ')}.`,
    vocabulary,
    dialogs: {
      beginner: rounds.map((r) => ({ ...r })),
      intermediate: rounds.map((r) => ({ ...r })),
      advanced: rounds.map((r) => ({ ...r })),
    },
    system_prompt:
      `You are the overseas buyer's QC manager in a scenario called "${name}". ` +
      'The user is a Chinese export salesperson in the apparel & textile industry. ' +
      `Stay in character, keep replies under 80 words, and steer the talk toward: ${keywords.join(', ')}. ` +
      'Ask one follow-up question each turn and expect professional, specific answers.',
    created_at: Date.now(),
  };
}

// POST /api/custom-scenarios/generate
customScenariosRoutes.post('/api/custom-scenarios/generate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { name?: unknown; keywords?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return c.json(errBody('VALIDATION_ERROR', 'name is required'), 400);
  }
  const keywords: string[] = Array.isArray(body.keywords)
    ? body.keywords.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter((k) => k.length > 0)
    : [];
  if (keywords.length === 0 || keywords.length > 20) {
    return c.json(errBody('VALIDATION_ERROR', 'keywords must be an array of 1-20 non-empty strings'), 400);
  }

  const id = `custom-${slugify(name)}-${Date.now().toString(36)}`;
  const mm = getMiniMaxEnv(c.env);

  // No credentials → deterministic mock scenario so the whole flow stays debuggable offline.
  if (!hasMiniMaxCredentials(mm)) {
    log.info(`No MiniMax credentials; returning mock custom scenario for "${name}"`);
    return c.json({ scenario: buildMockScenario(id, name, keywords) });
  }

  let raw = '';
  let llmMocked = false;
  try {
    const resp = await chatCompletion(mm, {
      system: GENERATE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Scenario name: ${name}\nKeywords: ${keywords.join(', ')}\nGenerate the scenario JSON now.`,
        },
      ],
      temperature: 0.7,
      maxTokens: 6000,
      responseFormatJson: true,
    });
    raw = resp.content ?? '';
    llmMocked = resp.mocked;
  } catch (err) {
    log.error(`custom scenario generation LLM call failed: ${(err as Error).message}`);
    return c.json(errBody('GENERATION_FAILED', (err as Error).message), 502);
  }

  // chatCompletion silently degrades to a mock reply when the remote call
  // fails (bad key, network, timeout). That mock is an echo, not scenario
  // JSON — so instead of 502ing, serve the deterministic sample scenario
  // to keep the whole flow debuggable.
  if (llmMocked) {
    log.warn(`LLM unavailable (mocked response); returning mock custom scenario for "${name}"`);
    return c.json({ scenario: buildMockScenario(id, name, keywords) });
  }

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch (err) {
    log.warn(`custom scenario JSON parse failed: ${(err as Error).message}; raw=${raw.slice(0, 200)}`);
    return c.json(errBody('GENERATION_FAILED', 'LLM output was not valid JSON', { raw: raw.slice(0, 200) }), 502);
  }

  const p = parsed as Partial<CustomScenario>;
  if (!p || typeof p !== 'object' || typeof p.system_prompt !== 'string' || typeof p.dialogs !== 'object' || p.dialogs === null) {
    return c.json(errBody('GENERATION_FAILED', 'LLM output missing required fields', { raw: raw.slice(0, 200) }), 502);
  }

  const scenario: CustomScenario = {
    id,
    name,
    keywords,
    title_zh: typeof p.title_zh === 'string' ? p.title_zh : name,
    title_en: typeof p.title_en === 'string' ? p.title_en : name,
    description_zh: typeof p.description_zh === 'string' ? p.description_zh : '',
    description_en: typeof p.description_en === 'string' ? p.description_en : '',
    vocabulary: Array.isArray(p.vocabulary) ? (p.vocabulary as CustomVocabularyEntry[]) : [],
    dialogs: p.dialogs as CustomScenario['dialogs'],
    system_prompt: p.system_prompt,
    created_at: Date.now(),
  };
  return c.json({ scenario });
});
