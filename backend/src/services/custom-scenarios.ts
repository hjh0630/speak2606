import { createLogger } from '../utils/logger';
import type {
  CustomDialogRound,
  CustomScenario,
  Difficulty,
} from '../types';

const log = createLogger('custom-scenarios');

/**
 * In-memory registry of LLM-generated custom scenarios, keyed by SESSION id
 * (the scenario payload is only carried through the HTTP body at
 * POST /api/sessions time, so we stash it here and look it up wherever the
 * static content store would normally be consulted).
 *
 * Volatile by design: custom scenarios disappear on server restart.
 */

const customScenariosBySession = new Map<string, CustomScenario>();

export function isCustomScenarioId(id: string): boolean {
  return id.startsWith('custom-');
}

export function setCustomScenario(sessionId: string, scenario: CustomScenario): void {
  customScenariosBySession.set(sessionId, scenario);
}

export function getCustomScenario(sessionId: string): CustomScenario | null {
  return customScenariosBySession.get(sessionId) ?? null;
}

export function getCustomRounds(scenario: CustomScenario, difficulty: Difficulty): CustomDialogRound[] {
  const rounds = scenario.dialogs?.[difficulty];
  if (Array.isArray(rounds) && rounds.length > 0) return rounds;
  const fallback = scenario.dialogs?.beginner;
  return Array.isArray(fallback) ? fallback : [];
}

export function getCustomDialogForRound(
  scenario: CustomScenario,
  difficulty: Difficulty,
  roundIndex: number,
): CustomDialogRound | null {
  const rounds = getCustomRounds(scenario, difficulty);
  if (rounds.length === 0) {
    log.warn(`custom scenario ${scenario.id} has no rounds for difficulty ${difficulty}`);
    return null;
  }
  const idx = Math.max(0, Math.min(roundIndex, rounds.length - 1));
  return rounds[idx] ?? null;
}
