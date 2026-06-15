import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { lookupWord } from '../services/dictionary';
import type { ApiErrorBody } from '../types';

interface DictionaryQuery {
  w?: string;
}

const dictionaryRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  // GET /api/dictionary?w=<word>
  // Tier 1: local garment-textile dictionary (instant, free).
  // Tier 2: MiniMax LLM fallback (1.5s hard timeout).
  // Tier 3: mock with "暂无释义" if both fail.
  app.get<{ Querystring: DictionaryQuery }>('/api/dictionary', async (req, reply) => {
    const w = (req.query.w ?? '').trim();
    if (!w) {
      const body: ApiErrorBody = {
        error: { code: 'INVALID_QUERY', message: 'query parameter "w" is required' },
      };
      return reply.code(400).send(body);
    }
    if (w.length > 50) {
      const body: ApiErrorBody = {
        error: { code: 'INVALID_QUERY', message: 'word too long (max 50 chars)' },
      };
      return reply.code(400).send(body);
    }
    try {
      const result = await lookupWord(w);
      return reply.send(result);
    } catch (err) {
      const body: ApiErrorBody = {
        error: { code: 'DICTIONARY_FAILED', message: (err as Error).message },
      };
      return reply.code(500).send(body);
    }
  });
};

export default dictionaryRoutes;
