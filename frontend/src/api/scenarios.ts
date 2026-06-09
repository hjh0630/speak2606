import { http } from './client'
import type { Scenario, ScenarioListResponse, Dialog } from '@/types/api'

export interface ListScenariosParams {
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  category?: string
  search?: string
}

export interface ScenarioDetail {
  scenario: Scenario
  dialogs: Dialog[]
}

// Map the backend's bilingual field set to the unified `Scenario` shape used
// by the UI.  The UI works either way because we always read through this
// mapper, never raw.
function normalizeScenario(raw: Record<string, unknown>): Scenario {
  const r = raw as Record<string, unknown> & {
    id?: string
    title_zh?: string
    title_en?: string
    title?: string
    subtitle?: string
    description_zh?: string
    description_en?: string
    description?: string
    difficulty?: string
    difficulty_levels?: string[]
    category?: string
    subcategory?: string
    ai_role?: string
    ai_role_zh?: string
    user_role?: string
    user_role_zh?: string
    key_skills?: string[]
    key_skills_zh?: string[]
    industry_terms_sample?: string[]
    estimated_minutes?: number
    icon?: string
    tags?: string[]
  }

  const title = r.title || r.title_zh || r.title_en || r.id || 'Untitled scenario'
  const subtitle = r.subtitle || r.title_en || r.subcategory || ''
  const description =
    r.description ||
    r.description_zh ||
    r.description_en ||
    ''

  const roles = {
    ai: r.ai_role_zh || r.ai_role || 'AI 对手',
    user: r.user_role_zh || r.user_role || '你',
  }

  // Goals: prefer English key_skills, fallback to Chinese, then empty.
  const goals = r.key_skills && r.key_skills.length > 0
    ? r.key_skills
    : (r.key_skills_zh ?? [])

  return {
    id: r.id as string,
    title,
    subtitle,
    description,
    difficulty: (r.difficulty as Scenario['difficulty']) || 'beginner',
    difficulty_levels: r.difficulty_levels as Difficulty[] | undefined,
    category: r.category,
    subcategory: r.subcategory,
    roles,
    goals,
    estimated_minutes: r.estimated_minutes,
    icon: r.icon,
    tags: r.tags,
    industry_terms_sample: r.industry_terms_sample,
    key_skills: r.key_skills,
    key_skills_zh: r.key_skills_zh,
  }
}

import type { Difficulty } from '@/types/api'

export async function listScenarios(
  params: ListScenariosParams = {},
): Promise<Scenario[]> {
  const res = await http.get<ScenarioListResponse | Scenario[] | { items: unknown[] } | unknown[]>(
    '/scenarios',
    { params },
  )
  let items: unknown[] = []
  if (Array.isArray(res.data)) items = res.data
  else if (res.data && Array.isArray((res.data as { items?: unknown[] }).items)) {
    items = (res.data as { items: unknown[] }).items
  }
  return items.map((it) => normalizeScenario(it as Record<string, unknown>))
}

export async function getScenario(id: string): Promise<Scenario> {
  // Backend may return { scenario, dialogs } OR a flat object — handle both.
  const res = await http.get<ScenarioDetail | Record<string, unknown> | Scenario>(
    `/scenarios/${encodeURIComponent(id)}`,
  )
  const data = res.data
  if (data && typeof data === 'object' && 'scenario' in (data as Record<string, unknown>)) {
    return normalizeScenario((data as ScenarioDetail).scenario as unknown as Record<string, unknown>)
  }
  return normalizeScenario(data as Record<string, unknown>)
}

/**
 * Returns the dialogs (one entry per difficulty) for a scenario.  The backend
 * serves these at `GET /api/scenarios/:id` together with the scenario meta.
 * We use this for follow-along ("repeat") mode to derive per-round prompts.
 */
export async function getScenarioDialogs(scenarioId: string): Promise<Dialog[]> {
  const res = await http.get<ScenarioDetail | Record<string, unknown>>(
    `/scenarios/${encodeURIComponent(scenarioId)}`,
  )
  const data = res.data as Record<string, unknown> | undefined
  if (data && Array.isArray((data as { dialogs?: unknown[] }).dialogs)) {
    return (data as { dialogs: Dialog[] }).dialogs
  }
  return []
}
