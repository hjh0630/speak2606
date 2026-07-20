/**
 * Content loader for Workers.
 *
 * Strategy: `import` the JSON files at build time (esbuild inlines them into
 * the worker bundle). At runtime, just JSON.parse the imported string. No fs,
 * no KV — content is part of the Worker binary.
 *
 * Total content size ≈ 984 KB (72 dialogs + scenarios + vocabulary + system_prompts),
 * which fits within the 10 MB Workers bundle limit (paid) or is at the edge
 * of the 1 MB free limit. See plan for cost discussion.
 *
 * If any content file is missing, we fall back to hard-coded defaults so the
 * Worker boots even if the build pipeline skipped a file.
 */
// Content JSON is copied into the workers project tree at build time
// (see scripts/sync-content.sh or the copy in wrangler.toml).
// @ts-ignore — esbuild resolves these as JSON modules.
import scenariosJson from '../../content/scenarios.json';
// @ts-ignore
import vocabularyJson from '../../content/vocabulary.json';
// @ts-ignore
import systemPromptsJson from '../../content/system_prompts.json';

import type {
  Difficulty,
  DialogRound,
  ScenarioDialogs,
  ScenarioMeta,
  VocabularyEntry,
} from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('content');

let _scenarios: ScenarioMeta[] | null = null;
let _dialogs: Map<string, ScenarioDialogs[]> | null = null;
let _vocabulary: VocabularyEntry[] | null = null;
let _systemPrompts: Record<Difficulty, string> | null = null;
let _loaded = false;

function safeParse<T>(raw: string, label: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    log.warn(`Failed to parse ${label}: ${(err as Error).message}`);
    return null;
  }
}

// Bundled JSON imports can be either already-parsed objects (TS resolveJsonModule)
// or strings (when the file is loaded as Text via wrangler [[rules]]). We accept both.
function asObject<T>(input: unknown, label: string): T | null {
  if (input == null) return null;
  if (typeof input === 'string') return safeParse<T>(input, label);
  return input as T;
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
    ];
    map.set(s.id, [{ scenario_id: s.id, difficulty: 'beginner', rounds }]);
  }
  return map;
}

function defaultSystemPrompts(): Record<Difficulty, string> {
  return {
    beginner:
      "You are a friendly overseas buyer speaking with a Chinese garment export salesperson. Use simple, short sentences. Speak slowly. Stay in character. Keep each reply under 60 words. Industry context: apparel & textile.",
    intermediate:
      "You are an experienced overseas buyer (apparel / textile). Use natural business English, medium-length sentences. Stay in character. Keep replies under 90 words. Ask follow-up questions to push the conversation forward.",
    advanced:
      "You are a sharp, time-pressed overseas buyer / sourcing manager in the apparel & textile industry. Use idiomatic business English. Keep replies under 120 words but expect substantive answers. Push back on weak arguments.",
  };
}

function difficultyFileSuffix(d: Difficulty): string {
  return d === 'beginner' ? '' : `_${d}`;
}

import { DIALOG_MODULES } from '../generated/dialog-manifest';

function loadAll(): void {
  if (_loaded) return;
  log.info('Loading bundled content');

  const scenarios = asObject<ScenarioMeta[]>(scenariosJson, 'scenarios.json');
  if (scenarios && Array.isArray(scenarios) && scenarios.length > 0) {
    _scenarios = scenarios;
    log.info(`Loaded ${scenarios.length} scenarios`);
  } else {
    log.warn('scenarios.json missing/empty; using defaults');
    _scenarios = defaultScenarios();
  }

  const dialogsMap = new Map<string, ScenarioDialogs[]>();
  for (const s of _scenarios) {
    const list: ScenarioDialogs[] = [];
    const rawModules: unknown[] = DIALOG_MODULES[s.id] ?? [];
    for (const data of rawModules) {
      if (Array.isArray(data)) {
        for (const entry of data) {
          if (entry && Array.isArray((entry as ScenarioDialogs).rounds)) {
            list.push({ ...(entry as ScenarioDialogs), difficulty: (entry as ScenarioDialogs).difficulty ?? 'beginner' });
          }
        }
      } else if (data && Array.isArray((data as ScenarioDialogs).rounds)) {
        list.push({ ...(data as ScenarioDialogs), difficulty: 'beginner' });
      }
    }
    if (list.length === 0) {
      const defaults = defaultDialogs().get(s.id) ?? [];
      list.push(...defaults);
    }
    dialogsMap.set(s.id, list);
  }
  _dialogs = dialogsMap;

  const vocab = asObject<VocabularyEntry[]>(vocabularyJson, 'vocabulary.json');
  if (vocab && Array.isArray(vocab) && vocab.length > 0) {
    _vocabulary = vocab;
    log.info(`Loaded ${vocab.length} vocabulary entries`);
  } else {
    log.warn('vocabulary.json missing/empty');
    _vocabulary = [];
  }

  const sp = asObject<Record<Difficulty, string>>(systemPromptsJson, 'system_prompts.json');
  if (sp && typeof sp === 'object' && (sp.beginner || sp.intermediate || sp.advanced)) {
    _systemPrompts = sp;
    log.info('Loaded system prompts');
  } else {
    log.warn('system_prompts.json missing/invalid; using defaults');
    _systemPrompts = defaultSystemPrompts();
  }

  _loaded = true;
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
