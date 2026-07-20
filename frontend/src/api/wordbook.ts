import { http } from './client'
import type {
  WordbookItem,
  WordbookListResponse,
  WordbookStats,
  WordbookDifficulty,
} from '@/types/api'

export interface ListWordbookParams {
  difficulty?: WordbookDifficulty
  search?: string
  limit?: number
  offset?: number
}

export interface CreateWordbookRequest {
  term: string
  meaning?: string | null
  source?: string
  source_ref?: string | null
  difficulty?: WordbookDifficulty
  notes?: string | null
}

export interface PatchWordbookRequest {
  difficulty?: WordbookDifficulty
  notes?: string | null
}

/**
 * GET /api/wordbook — list current user's wordbook, paginated, filterable by
 * difficulty + search. Backend returns `{ items, total, limit, offset, count,
 * difficulty, search }`. We surface the same shape to callers.
 */
export async function listWordbook(
  params: ListWordbookParams = {},
): Promise<WordbookListResponse> {
  const res = await http.get<WordbookListResponse>('/wordbook', { params })
  return res.data
}

/**
 * POST /api/wordbook — add (or upsert) a single word. Idempotent on term:
 * re-adding the same word returns the existing row, not a duplicate.
 */
export async function addWord(body: CreateWordbookRequest): Promise<WordbookItem> {
  const res = await http.post<{ item: WordbookItem }>('/wordbook', body)
  return res.data.item
}

/**
 * PATCH /api/wordbook/:id — update difficulty and/or notes.
 */
export async function updateWord(
  id: number,
  body: PatchWordbookRequest,
): Promise<WordbookItem> {
  const res = await http.patch<{ item: WordbookItem }>(
    `/wordbook/${encodeURIComponent(String(id))}`,
    body,
  )
  return res.data.item
}

/**
 * DELETE /api/wordbook/:id — delete a single entry.
 */
export async function deleteWord(id: number): Promise<{ deleted: number }> {
  const res = await http.delete<{ deleted: number }>(
    `/wordbook/${encodeURIComponent(String(id))}`,
  )
  return res.data
}

/**
 * POST /api/wordbook/batch-delete — delete many entries in one call.
 * Returns counts so the UI can show "deleted N of M".
 */
export async function batchDelete(
  ids: number[],
): Promise<{ deleted: number; requested: number }> {
  const res = await http.post<{ deleted: number; requested: number }>(
    '/wordbook/batch-delete',
    { ids },
  )
  return res.data
}

/**
 * POST /api/wordbook/batch-check — given a list of terms, return the subset
 * that already exist in the current user's wordbook. Used to render "已加入"
 * badges without issuing N GETs.
 */
export async function batchCheck(terms: string[]): Promise<{ saved: string[] }> {
  const res = await http.post<{ saved: string[] }>('/wordbook/batch-check', { terms })
  return res.data
}

/**
 * GET /api/wordbook/stats — summary used for the top KPI strip.
 */
export async function getWordbookStats(): Promise<WordbookStats> {
  const res = await http.get<WordbookStats>('/wordbook/stats')
  return res.data
}
