/**
 * /api/scenarios routes — list and detail.
 */
import { Hono } from 'hono';
import { getScenarios, getScenarioById, getDialogsForScenario } from '../services/content';
import type { Bindings } from '../env';

export const scenariosRoutes = new Hono<{ Bindings: Bindings }>();

scenariosRoutes.get('/api/scenarios', (c) => {
  try {
    const list = getScenarios();
    return c.json({ items: list, count: list.length });
  } catch (err) {
    return c.json(
      { error: { code: 'SCENARIOS_LIST_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

scenariosRoutes.get('/api/scenarios/:id', (c) => {
  const id = c.req.param('id');
  try {
    const scenario = getScenarioById(id);
    if (!scenario) {
      return c.json(
        { error: { code: 'SCENARIO_NOT_FOUND', message: `scenario '${id}' not found` } },
        404,
      );
    }
    const dialogs = getDialogsForScenario(id);
    return c.json({ scenario, dialogs });
  } catch (err) {
    return c.json(
      { error: { code: 'SCENARIO_FETCH_FAILED', message: (err as Error).message } },
      500,
    );
  }
});
