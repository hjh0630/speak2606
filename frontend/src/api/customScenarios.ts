import { http } from './client'
import type { CustomScenario } from '@/types/api'

export interface GenerateCustomScenarioRequest {
  name: string
  keywords: string[]
}

/**
 * Ask the backend to generate a full custom scenario (title / description /
 * vocabulary / per-difficulty dialogs / system prompt) from a user-provided
 * name and keyword list.  Generation runs an LLM round-trip, so we allow a
 * longer timeout than the default 60 s.
 */
export async function generateCustomScenario(
  payload: GenerateCustomScenarioRequest,
): Promise<CustomScenario> {
  const res = await http.post<{ scenario: CustomScenario } | CustomScenario>(
    '/custom-scenarios/generate',
    payload,
    { timeout: 180_000 },
  )
  const data = res.data
  if (data && typeof data === 'object' && 'scenario' in data) {
    return (data as { scenario: CustomScenario }).scenario
  }
  return data as CustomScenario
}
