/**
 * /api/dictionary route — tiered word lookup.
 */
import { Hono } from 'hono';
import { lookupWord } from '../services/dictionary';
import { getMiniMaxEnv, type Bindings } from '../env';

export const dictionaryRoutes = new Hono<{ Bindings: Bindings }>();

dictionaryRoutes.get('/api/dictionary', async (c) => {
  const w = (c.req.query('w') ?? '').trim();
  if (!w) {
    return c.json(
      { error: { code: 'INVALID_QUERY', message: 'query parameter "w" is required' } },
      400,
    );
  }
  if (w.length > 50) {
    return c.json(
      { error: { code: 'INVALID_QUERY', message: 'word too long (max 50 chars)' } },
      400,
    );
  }
  try {
    const mm = getMiniMaxEnv(c.env);
    const result = await lookupWord(mm, w);
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: { code: 'DICTIONARY_FAILED', message: (err as Error).message } },
      500,
    );
  }
});
