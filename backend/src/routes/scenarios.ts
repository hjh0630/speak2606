import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getScenarios, getScenarioById, getDialogsForScenario } from '../services/content';
import { ApiErrorBody } from '../types';

interface Params {
  id: string;
}

const scenariosRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/scenarios', async (_req, reply) => {
    try {
      const list = getScenarios();
      return reply.send({ items: list, count: list.length });
    } catch (err) {
      const body: ApiErrorBody = {
        error: { code: 'SCENARIOS_LIST_FAILED', message: (err as Error).message },
      };
      return reply.code(500).send(body);
    }
  });

  app.get<{ Params: Params }>('/api/scenarios/:id', async (req, reply) => {
    const { id } = req.params;
    try {
      const scenario = getScenarioById(id);
      if (!scenario) {
        const body: ApiErrorBody = {
          error: { code: 'SCENARIO_NOT_FOUND', message: `scenario '${id}' not found` },
        };
        return reply.code(404).send(body);
      }
      const dialogs = getDialogsForScenario(id);
      return reply.send({ scenario, dialogs });
    } catch (err) {
      const body: ApiErrorBody = {
        error: { code: 'SCENARIO_FETCH_FAILED', message: (err as Error).message },
      };
      return reply.code(500).send(body);
    }
  });
};

export default scenariosRoutes;
