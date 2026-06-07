import { http } from './client'
import type {
  StatsByDifficultyRow,
  StatsByScenarioRow,
  StatsOverview,
  StatsTrendPoint,
} from '@/types/api'

export async function getStats(): Promise<StatsOverview> {
  const res = await http.get<Record<string, unknown>>('/stats')
  const r = res.data as {
    total_sessions?: number
    completed_sessions?: number
    active_sessions?: number
    total_practice_sec?: number
    total_messages?: number
    avg_session_sec?: number
    avg_score?: number
    average_score?: number
    best_score?: number
    practice_minutes?: number
    by_scenario?: Array<Record<string, unknown>>
    by_difficulty?: Array<Record<string, unknown>>
    trend?: Array<Record<string, unknown>>
  }
  const totalPracticeSec = r.total_practice_sec ?? 0
  const byScenario: StatsByScenarioRow[] = (r.by_scenario ?? []).map((row) => ({
    scenario_id: String(row.scenario_id ?? ''),
    scenario_title: (row.scenario_title as string) ?? String(row.scenario_id ?? ''),
    sessions: Number(row.sessions ?? row.count ?? 0),
    count: Number(row.sessions ?? row.count ?? 0),
    avg_score: Number(row.avg_score ?? 0),
  }))
  const byDifficulty: StatsByDifficultyRow[] = (r.by_difficulty ?? []).map((row) => ({
    difficulty: (row.difficulty as StatsByDifficultyRow['difficulty']) ?? 'beginner',
    sessions: Number(row.sessions ?? row.count ?? 0),
    count: Number(row.sessions ?? row.count ?? 0),
    avg_score: Number(row.avg_score ?? 0),
  }))
  const trend: StatsTrendPoint[] = (r.trend ?? []).map((p) => ({
    date: String(p.date ?? ''),
    avg_score: Number(p.avg_score ?? 0),
    sessions: Number(p.sessions ?? 0),
  }))
  return {
    total_sessions: Number(r.total_sessions ?? 0),
    total_messages: Number(r.total_messages ?? 0),
    completed_sessions: Number(r.completed_sessions ?? 0),
    active_sessions: Number(r.active_sessions ?? 0),
    total_practice_sec: totalPracticeSec,
    practice_minutes:
      Number(r.practice_minutes ?? Math.round(totalPracticeSec / 60)),
    avg_session_sec: Number(r.avg_session_sec ?? 0),
    average_score: Number(r.average_score ?? r.avg_score ?? 0),
    best_score: Number(r.best_score ?? 0),
    by_scenario: byScenario,
    by_difficulty: byDifficulty,
    trend,
  }
}
