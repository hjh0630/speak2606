import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import type {
  Difficulty,
  DialogRound,
  ScenarioDialogs,
  ScenarioMeta,
  VocabularyEntry,
} from '../types';

const log = createLogger('content');

/**
 * Reads static content from /workspace/content (or wherever CONTENT_DIR points).
 * Falls back to a minimal in-memory default if the directory is missing — this lets
 * the backend start during integration before the content team has produced files.
 *
 * Also scans a sibling sub-directory `textile-english/` (sibling of `dialogs/`)
 * which holds the "纺织服装全链条英语沟通" module — that directory carries
 * its own scenarios.json, vocabulary.json and `dialogs/<id>{_diff}.json`. The
 * two sources are merged by id; later sources override earlier ones.
 *
 * Two dialog file shapes are supported:
 *  (a) Standard:    `[{...}, {...}]` or `{ scenario_id, difficulty, rounds }`
 *  (b) Keyed triple: `{ beginner: {...}, intermediate: {...}, advanced: {...} }`
 *                    (used by the textile-english module — easier to maintain).
 *
 * Cached after first read.
 */

let _scenarios: ScenarioMeta[] | null = null;
let _dialogs: Map<string, ScenarioDialogs[]> | null = null; // key: scenario_id
let _vocabulary: VocabularyEntry[] | null = null;
let _systemPrompts: Record<Difficulty, string> | null = null;
let _loaded = false;

function safeReadJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    log.warn(`Failed to read ${filePath}: ${(err as Error).message}`);
    return null;
  }
}

function defaultScenarios(): ScenarioMeta[] {
  return [
    {
      id: 'phone_meeting',
      title_zh: '电话会议',
      title_en: 'Phone Meeting',
      icon: '📞',
      description_zh: '与海外客户初次/跟进通话',
      difficulty_levels: ['beginner', 'intermediate', 'advanced'],
      ai_role: '海外采购商 / 客户',
      user_role: '中国外贸业务员(服装纺织)',
      key_skills: ['opening call', 'presenting samples', 'negotiating price', 'closing'],
    },
    {
      id: 'inquiry_quote',
      title_zh: '询盘报价',
      title_en: 'Inquiry & Quote',
      icon: '💼',
      description_zh: '收到 RFQ、报价、议价',
      difficulty_levels: ['beginner', 'intermediate', 'advanced'],
      ai_role: '海外采购商',
      user_role: '中国外贸业务员',
      key_skills: ['responding to RFQ', 'quoting CIF / FOB', 'handling objections'],
    },
    {
      id: 'factory_audit',
      title_zh: '工厂参观/验厂',
      title_en: 'Factory Audit',
      icon: '🏭',
      description_zh: '接待客户验厂、介绍产线产能',
      difficulty_levels: ['beginner', 'intermediate', 'advanced'],
      ai_role: '第三方验厂代表 / 品牌买手',
      user_role: '中国外贸业务员 / 厂方负责人',
      key_skills: ['presenting capacity', 'walking the line', 'answering compliance questions'],
    },
    {
      id: 'logistics_shipping',
      title_zh: '物流/船期/单证',
      title_en: 'Logistics & Shipping',
      icon: '🚢',
      description_zh: '催货、装柜、提单、报关',
      difficulty_levels: ['beginner', 'intermediate', 'advanced'],
      ai_role: '货代 / 客户物流经理',
      user_role: '中国外贸业务员',
      key_skills: ['booking vessel', 'checking ETD', 'preparing documents'],
    },
    {
      id: 'sample_development',
      title_zh: '款式开发/打样',
      title_en: 'Sample Development',
      icon: '🧵',
      description_zh: '确认样板、工艺、修改',
      difficulty_levels: ['beginner', 'intermediate', 'advanced'],
      ai_role: '客户设计师 / 买手',
      user_role: '中国外贸业务员',
      key_skills: ['discussing handfeel', 'modifying spec', 'quoting sample cost'],
    },
    {
      id: 'claim_aftersales',
      title_zh: '索赔/售后',
      title_en: 'Claim & After-sales',
      icon: '⚖️',
      description_zh: '质量问题、延误的沟通谈判',
      difficulty_levels: ['beginner', 'intermediate', 'advanced'],
      ai_role: '客户投诉负责人',
      user_role: '中国外贸业务员',
      key_skills: ['acknowledging issues', 'negotiating compensation', 'proposing CAPA'],
    },
  ];
}

function defaultDialogs(): Map<string, ScenarioDialogs[]> {
  const map = new Map<string, ScenarioDialogs[]>();
  const scenarios = defaultScenarios();
  for (const s of scenarios) {
    const rounds: DialogRound[] = [
      {
        round: 1,
        ai_message: `Hello, this is Mark from ABC Trading in New York. May I speak with Mr. Chen about the ${s.title_en}?`,
        ai_message_zh: '你好,我是纽约 ABC Trading 的 Mark,请问陈先生在吗?',
        expected_user_response_hint: '自我介绍并询问来意',
        key_phrases: ['This is ...', 'May I speak with ...', 'How can I help you'],
        common_mistakes: '中式英语:This is Mark speaking 后面不要加 I am',
        tips_zh: '接电话先自报公司,不要只报名字',
      },
      {
        round: 2,
        ai_message: "We're interested in your new collection. Could you send me the catalog and price list?",
        ai_message_zh: '我们对你们的新品感兴趣,能发一下目录和报价单吗?',
        expected_user_response_hint: '确认收件邮箱,简要说明下一步动作',
        key_phrases: ['Sure, I will email you', 'Could I have your email', 'within 24 hours'],
        common_mistakes: "Don't say 'send to you later' — be specific about timing",
        tips_zh: '主动确认邮箱,给出明确时间',
      },
      {
        round: 3,
        ai_message: "What's your best price for 1000 pieces, FOB Shanghai?",
        ai_message_zh: '1000 件 FOB 上海最好价格是多少?',
        expected_user_response_hint: '说明价格构成、给一个区间或留出议价空间',
        key_phrases: ['Our best price is ...', 'depending on quantity', 'FOB Shanghai'],
        common_mistakes: '不要一上来就报最低价',
        tips_zh: '先说取决于数量/材料,再给区间',
      },
      {
        round: 4,
        ai_message: 'Can you do handfeel a bit softer? The current sample feels a little rough.',
        ai_message_zh: '手感能再软一点吗?现在的样品有点糙。',
        expected_user_response_hint: '确认可以调整,问具体洗水/工艺要求',
        key_phrases: ['Sure, we can adjust', 'softener wash', 'could you tell me your target handfeel'],
        common_mistakes: "不要直接说 'no problem' — 改成确认能做什么",
        tips_zh: '外贸里 softener wash / enzyme wash 是常用词',
      },
      {
        round: 5,
        ai_message: "What's the lead time for bulk production after sample approval?",
        ai_message_zh: '样品确认后大货交期多久?',
        expected_user_response_hint: '给出具体交期 + 分阶段里程碑',
        key_phrases: ['lead time', 'around 30-45 days', 'after sample approval'],
        common_mistakes: '不要只说 "fast" 或 "soon"',
        tips_zh: '30-45 days 是常见区间,记得加上 sample approval 后',
      },
      {
        round: 6,
        ai_message: 'OK, please send the PI and we will arrange the TT payment this week.',
        ai_message_zh: '好的,请发 PI,我们本周安排 TT 付款。',
        expected_user_response_hint: '确认会发 PI、感谢客户、表达后续配合',
        key_phrases: ['Proforma Invoice', 'TT payment', 'thank you for your order'],
        common_mistakes: '不要把 PI 念成字母 P I,要全称',
        tips_zh: '结尾记得感谢客户 + 表达期待后续合作',
      },
    ];
    const all: ScenarioDialogs[] = [];
    for (const diff of s.difficulty_levels) {
      all.push({ scenario_id: s.id, difficulty: diff, rounds: rounds.map((r) => ({ ...r })) });
    }
    map.set(s.id, all);
  }
  return map;
}

function defaultSystemPrompts(): Record<Difficulty, string> {
  return {
    beginner:
      "You are a friendly overseas buyer speaking with a Chinese garment export salesperson. Use simple, short sentences. Speak slowly. Pause for the user. Stay in character. Keep each reply under 60 words. Industry context: apparel & textile (MOQ, lead time, FOB / CIF, handfeel, GSM, sample, bulk order). Encourage the user to answer in English. If the user makes a grammar mistake, do NOT correct them mid-conversation — keep the dialogue natural. After each of your replies, you may include a one-line hint in parentheses if the user is clearly stuck.",
    intermediate:
      "You are an experienced overseas buyer (apparel / textile) on a call with a Chinese export salesperson. Use natural business English, medium-length sentences. Stay in character. Keep replies under 90 words. Industry context: MOQ, lead time, FOB / CIF, handfeel, GSM, yarn count, sample yardage, bulk order, PI, TT payment, QC, claim. Ask follow-up questions to push the conversation forward. If the user goes off-topic, gently redirect.",
    advanced:
      "You are a sharp, time-pressed overseas buyer / sourcing manager in the apparel & textile industry. Use idiomatic business English, contractions, occasional industry jargon (handfeel, GSM, CMT, FOB, CIF, LDP, ODP, ETD, ETA, B/L, TT, LC, CAPA). Keep replies under 120 words but expect substantive, professional answers. Push back on weak arguments, demand specifics, and challenge price / lead time claims. The user is expected to defend their position professionally.",
  };
}

function difficultyFileSuffix(d: Difficulty): string {
  return d === 'beginner' ? '' : `_${d}`;
}

function loadAll(): void {
  if (_loaded) return;
  const contentDir = config.contentDir;
  log.info(`Loading content from ${contentDir}`);

  // Primary directory may be missing → fall back to defaults. Sub-directories
  // (e.g. textile-english/) are best-effort — if absent we just skip them.
  if (!fs.existsSync(contentDir)) {
    log.warn(`Content directory ${contentDir} does not exist; using in-memory defaults.`);
    _scenarios = defaultScenarios();
    _dialogs = defaultDialogs();
    _vocabulary = [];
    _systemPrompts = defaultSystemPrompts();
    _loaded = true;
    return;
  }

  // ── Build the list of content roots in merge order. Later wins. ─────────
  const contentRoots: string[] = [contentDir];
  const textileDir = path.join(contentDir, 'textile-english');
  if (fs.existsSync(textileDir)) contentRoots.push(textileDir);
  const shoeUpperDir = path.join(contentDir, 'shoe-upper');
  if (fs.existsSync(shoeUpperDir)) contentRoots.push(shoeUpperDir);

  // ── Scenarios: read every root's scenarios.json and merge by id. ─────────
  const scenarioMap = new Map<string, ScenarioMeta>();
  let scenariosFromDisk = 0;
  for (const root of contentRoots) {
    const file = path.join(root, 'scenarios.json');
    const data = safeReadJson<ScenarioMeta[]>(file);
    if (data && Array.isArray(data)) {
      const moduleTag: 'foreign-trade' | 'textile-apparel' | 'shoe-upper' =
        root === textileDir ? 'textile-apparel' :
        root === shoeUpperDir ? 'shoe-upper' :
        'foreign-trade';
      for (const s of data) {
        if (s && typeof s.id === 'string' && s.id.length > 0) {
          // Stamp the module tag from the source root, but let an explicit
          // field on disk win so authors can override if needed.
          const merged: ScenarioMeta = { ...s, module: s.module ?? moduleTag };
          scenarioMap.set(s.id, merged);
          scenariosFromDisk++;
        }
      }
    }
  }
  if (scenariosFromDisk > 0) {
    _scenarios = Array.from(scenarioMap.values());
    log.info(`Loaded ${_scenarios.length} scenarios across ${contentRoots.length} root(s)`);
  } else {
    log.warn('scenarios.json missing or empty in every root; using defaults');
    _scenarios = defaultScenarios();
  }
  // ── Dialogs: read every root's dialogs/<id>{_diff}.json and merge. ─────
  const dialogsMap = new Map<string, ScenarioDialogs[]>();
  const noDialogScenarios: string[] = [];
  const allDifficulties: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
  for (const s of _scenarios) {
    const list: ScenarioDialogs[] = [];
    for (const diff of allDifficulties) {
      if (!s.difficulty_levels.includes(diff)) continue;
      for (const root of contentRoots) {
        const filePath = path.join(root, 'dialogs', `${s.id}${difficultyFileSuffix(diff)}.json`);
        const data = safeReadJson<ScenarioDialogs | ScenarioDialogs[] | Record<string, ScenarioDialogs | ScenarioDialogs[]>>(filePath);
        if (data === null) continue;
        const collected = collectDialogs(data, diff);
        if (collected.length > 0) {
          list.push(...collected);
          // First root with a hit wins for this difficulty — no fan-out across roots.
          break;
        }
      }
      // Fallback to beginner file when an intermediate/advanced variant is absent.
      if (
        diff !== 'beginner' &&
        !list.some((d) => d.difficulty === diff)
      ) {
        for (const root of contentRoots) {
          const fallbackPath = path.join(root, 'dialogs', `${s.id}.json`);
          const data = safeReadJson<ScenarioDialogs | ScenarioDialogs[] | Record<string, ScenarioDialogs | ScenarioDialogs[]>>(fallbackPath);
          if (data === null) continue;
          const collected = collectDialogs(data, diff);
          if (collected.length > 0) {
            log.warn(
              `Missing ${s.id} dialog at difficulty ${diff}; falling back to beginner`,
            );
            list.push(...collected);
            break;
          }
        }
      }
    }
    if (list.length === 0) {
      // 该场景在磁盘上没有任何对话脚本。
      // 之前的做法是回落成通用默认话术（"No dialogs for xxx, using defaults"），
      // 结果用户点进去练到的是「内容根本不存在」的场景。
      // 现在改为：从场景列表里隐藏它。scenarios.json 里的定义仍然保留，
      // 补上 content/dialogs/<id>.json 后它会自动重新出现。
      noDialogScenarios.push(s.id);
      continue;
    }
    dialogsMap.set(s.id, list);
  }
  if (noDialogScenarios.length > 0) {
    log.warn(
      `Hidden ${noDialogScenarios.length} scenario(s) with no dialog content: ${noDialogScenarios.join(', ')}`,
    );
    _scenarios = _scenarios.filter((s) => !noDialogScenarios.includes(s.id));
  }
  // 同一难度只保留一份：一个场景只备了基础文件 <id>.json 时，
  // intermediate 与 advanced 都会回落到它 → 列表里出现两份完全相同的内容。
  for (const [sid, list] of dialogsMap) {
    const seen = new Set<Difficulty>();
    const deduped = list.filter((d) => {
      if (seen.has(d.difficulty)) return false;
      seen.add(d.difficulty);
      return true;
    });
    if (deduped.length !== list.length) {
      log.warn(`Deduped ${list.length - deduped.length} duplicate dialog entry for ${sid}`);
    }
    dialogsMap.set(sid, deduped);
  }
  _dialogs = dialogsMap;

  // ── Vocabulary: read every root's vocabulary.json and concatenate. ─────
  const vocabAll: VocabularyEntry[] = [];
  for (const root of contentRoots) {
    const v = safeReadJson<VocabularyEntry[]>(path.join(root, 'vocabulary.json'));
    if (v && Array.isArray(v)) vocabAll.push(...v);
  }
  if (vocabAll.length > 0) {
    _vocabulary = vocabAll;
    log.info(`Loaded ${_vocabulary.length} vocabulary entries across ${contentRoots.length} root(s)`);
  } else {
    log.warn('vocabulary.json missing or empty in every root');
    _vocabulary = [];
  }

  // ── System prompts: read once from the primary root. ──────────────────
  const sp = safeReadJson<Record<Difficulty, string>>(path.join(contentDir, 'system_prompts.json'));
  if (sp && typeof sp === 'object' && (sp.beginner || sp.intermediate || sp.advanced)) {
    _systemPrompts = sp;
    log.info('Loaded system prompts from disk');
  } else {
    log.warn('system_prompts.json missing or invalid; using defaults');
    _systemPrompts = defaultSystemPrompts();
  }

  _loaded = true;
}

/**
 * Normalise a dialog-file payload into ScenarioDialogs[].
 *
 * Three accepted shapes:
 *  (1) `ScenarioDialogs[]` — array of entries (each has rounds + difficulty)
 *  (2) `ScenarioDialogs`    — single entry
 *  (3) `{ beginner, intermediate, advanced }` keyed triple — each value is
 *      either a ScenarioDialogs or an array of them. The active `diff` (the
 *      filename we asked for) is preferred; if absent, all three are kept
 *      under their own difficulty.
 */
function collectDialogs(
  raw: ScenarioDialogs | ScenarioDialogs[] | Record<string, unknown> | null | undefined,
  activeDiff: Difficulty,
): ScenarioDialogs[] {
  // Shape 3: keyed triple — detect by presence of any difficulty key.
  if (
    raw !== null &&
    raw !== undefined &&
    !Array.isArray(raw) &&
    typeof raw === 'object'
  ) {
    const obj = raw as Record<string, unknown>;
    if (
      obj.beginner !== undefined ||
      obj.intermediate !== undefined ||
      obj.advanced !== undefined
    ) {
      const out: ScenarioDialogs[] = [];
      const keys: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
      for (const k of keys) {
        const v = obj[k];
        if (v === undefined || v === null) continue;
        out.push(...collectDialogs(v as ScenarioDialogs | ScenarioDialogs[], k));
      }
      if (out.length === 0) {
        log.warn(`Keyed dialog file for ${activeDiff} contained no usable rounds`);
      }
      return out;
    }
  }
  if (Array.isArray(raw)) {
    const out: ScenarioDialogs[] = [];
    for (const entry of raw) {
      if (entry && typeof entry === 'object' && Array.isArray((entry as ScenarioDialogs).rounds)) {
        const e = entry as ScenarioDialogs;
        out.push({ ...e, difficulty: e.difficulty ?? activeDiff });
      }
    }
    return out;
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as ScenarioDialogs).rounds)) {
    return [{ ...(raw as ScenarioDialogs), difficulty: activeDiff }];
  }
  // Shape 4: 新版内容结构 —— { scenario_id, title, difficulty, context, dialogue: [...] }
  // 2026-10 的真实案例：上游新增的实战场景（gap_vdd_coo_sourcing / ninetide_fob_negotiation）
  // 用了 dialogue[] + ai_prompt/target_concept/reference_response/keywords 这一套字段，
  // 与全局通用的 rounds[] + ai_message/... 不是同一套 → 旧解析器读不到，
  // 场景被当成「无对话内容」而回落成默认话术。
  // 这里做一层归一化，让两种结构都能用，内容文件本身不用改。
  if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).dialogue)) {
    const obj = raw as Record<string, unknown>;
    const rounds = (obj.dialogue as Array<Record<string, unknown>>)
      .filter((r) => r && typeof r === 'object')
      .map((r, idx) => ({
        round: typeof r.round === 'number' ? r.round : idx + 1,
        ai_message: String(r.ai_prompt ?? r.ai_message ?? ''),
        ai_message_zh: String(r.ai_message_zh ?? r.ai_prompt_zh ?? ''),
        expected_user_response_hint: String(r.target_concept ?? r.expected_user_response_hint ?? ''),
        key_phrases: Array.isArray(r.keywords)
          ? r.keywords.map(String)
          : Array.isArray(r.key_phrases)
            ? r.key_phrases.map(String)
            : [],
        common_mistakes: String(r.common_mistakes ?? ''),
        tips_zh: String(r.cultural_tip ?? r.tips_zh ?? ''),
        ...(typeof r.native_polish === 'string' ? { native_polish: r.native_polish } : {}),
      }))
      .filter((r) => r.ai_message.length > 0);
    if (rounds.length > 0) {
      return [
        {
          scenario_id: String(obj.scenario_id ?? ''),
          difficulty: (typeof obj.difficulty === 'string' ? obj.difficulty : activeDiff) as Difficulty,
          rounds,
        } as ScenarioDialogs,
      ];
    }
  }
  return [];
}

export function getScenarios(): ScenarioMeta[] {
  if (!_loaded) loadAll();
  return _scenarios ?? [];
}

export function getScenarioById(id: string): ScenarioMeta | null {
  if (!_loaded) loadAll();
  return (_scenarios ?? []).find((s) => s.id === id) ?? null;
}

export function getDialogsForScenario(scenarioId: string): ScenarioDialogs[] {
  if (!_loaded) loadAll();
  return _dialogs?.get(scenarioId) ?? [];
}

export function getDialogForRound(
  scenarioId: string,
  difficulty: Difficulty,
  roundIndex: number,
): DialogRound | null {
  const list = getDialogsForScenario(scenarioId);
  const entry = list.find((d) => d.difficulty === difficulty) ?? list[0];
  if (!entry) return null;
  const idx = Math.max(0, Math.min(roundIndex, entry.rounds.length - 1));
  return entry.rounds[idx] ?? null;
}

export function getSystemPrompt(difficulty: Difficulty): string {
  if (!_loaded) loadAll();
  const sp = _systemPrompts ?? defaultSystemPrompts();
  return sp[difficulty] ?? sp.intermediate;
}

export function getVocabulary(): VocabularyEntry[] {
  if (!_loaded) loadAll();
  return _vocabulary ?? [];
}
