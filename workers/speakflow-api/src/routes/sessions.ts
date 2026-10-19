/**
 * /api/sessions routes — the meat of the app:
 *   POST /api/sessions                          — create
 *   GET  /api/sessions/:id                      — fetch + aggregated counts
 *   GET  /api/sessions/:id/prompts              — per-round targets
 *   POST /api/sessions/:id/messages             — single-turn flow (transcribe→score→reply→TTS)
 *   POST /api/sessions/:id/transcribe           — ASR-only helper
 *   POST /api/sessions/:id/feedback             — explicit end-of-session feedback
 *   POST /api/sessions/:id/complete             — close session
 *   POST /api/tts                               — public TTS utility
 */
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import {
  appendMessage,
  advanceRound,
  completeSession,
  createSession,
  getMessages,
  getSession,
  NotFoundError,
  toLlmContext,
  ValidationError,
} from '../services/session-manager';
import { chatCompletion, buildConversationSystemPrompt } from '../services/llm';
import { textToAudio, TTS_DEFAULT_VOICE, TTS_VOICES } from '../services/tts';
import { transcribeBuffer } from '../services/asr';
import { scoreWithLlm, scoreRepeat, safeParseScore } from '../services/scoring';
import { getScenarioById, getDialogForRound, getDialogsForScenario, getSystemPrompt } from '../services/content';
import {
  getCustomDialogForRound,
  getCustomRounds,
  getCustomScenario,
  isCustomScenarioId,
  setCustomScenario,
} from '../services/custom-scenarios';
import { saveAudioForSession } from '../services/audio';
import { getMiniMaxEnv, type Bindings } from '../env';
import { runAsync } from '../db';
import type { CustomScenario, DialogRound, Difficulty, LlmChatMessage, ScoreFeedback, SessionMode } from '../types';

export const sessionsRoutes = new Hono<{ Bindings: Bindings }>();

function isValidDifficulty(d: unknown): d is Difficulty {
  return d === 'beginner' || d === 'intermediate' || d === 'advanced';
}
function isValidMode(m: unknown): m is SessionMode {
  return m === 'free' || m === 'repeat';
}

// POST /api/sessions
sessionsRoutes.post('/api/sessions', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body.scenario_id || typeof body.scenario_id !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'scenario_id is required' } }, 400);
  }
  if (!isValidDifficulty(body.difficulty)) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'difficulty must be beginner|intermediate|advanced' } },
      400,
    );
  }
  if (!isValidMode(body.mode)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'mode must be free|repeat' } }, 400);
  }
  // Custom (LLM-generated) scenarios are not in the static content store;
  // the client carries the full payload in `custom_scenario` and we stash it
  // in an in-memory registry keyed by session id.
  const isCustom = isCustomScenarioId(body.scenario_id);
  let customScenario: CustomScenario | null = null;
  if (isCustom) {
    const cs = body.custom_scenario as Partial<CustomScenario> | null | undefined;
    if (
      !cs ||
      typeof cs !== 'object' ||
      typeof cs.system_prompt !== 'string' ||
      typeof cs.dialogs !== 'object' ||
      cs.dialogs === null
    ) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'custom_scenario is required when scenario_id starts with "custom-"',
          },
        },
        400,
      );
    }
    customScenario = cs as CustomScenario;
  } else {
    const scenario = getScenarioById(body.scenario_id);
    if (!scenario) {
      return c.json(
        { error: { code: 'SCENARIO_NOT_FOUND', message: `scenario '${body.scenario_id}' not found` } },
        404,
      );
    }
  }
  try {
    const rec = await createSession(c.env.DB, {
      scenario_id: body.scenario_id,
      difficulty: body.difficulty,
      mode: body.mode,
    });
    if (customScenario) {
      setCustomScenario(rec.id, customScenario);
    }
    return c.json(
      {
        session_id: rec.id,
        scenario_id: rec.scenario_id,
        difficulty: rec.difficulty,
        mode: rec.mode,
        status: rec.status,
        started_at: rec.started_at,
      },
      201,
    );
  } catch (err) {
    return c.json(
      { error: { code: 'SESSION_CREATE_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

// GET /api/sessions/:id
sessionsRoutes.get('/api/sessions/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const rec = await getSession(c.env.DB, id);
    if (!rec) {
      return c.json(
        { error: { code: 'SESSION_NOT_FOUND', message: `session '${id}' not found` } },
        404,
      );
    }
    const messages = await getMessages(c.env.DB, id);
    const userTurns = messages.filter((m) => m.role === 'user');
    const scoresArr = userTurns
      .map((m) => (typeof m.score === 'number' ? m.score : null))
      .filter((s): s is number => s !== null);
    const avgScore =
      scoresArr.length > 0 ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length) : null;
    return c.json({
      ...rec,
      message_count: messages.length,
      user_turn_count: userTurns.length,
      avg_score: avgScore,
    });
  } catch (err) {
    return c.json(
      { error: { code: 'SESSION_FETCH_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

// GET /api/sessions/:id/prompts
sessionsRoutes.get('/api/sessions/:id/prompts', async (c) => {
  try {
    const rec = await getSession(c.env.DB, c.req.param('id'));
    if (!rec) {
      return c.json(
        { error: { code: 'SESSION_NOT_FOUND', message: `session '${c.req.param('id')}' not found` } },
        404,
      );
    }
    const requestedDifficulty = c.req.query('difficulty');
    const difficulty: Difficulty =
      requestedDifficulty && isValidDifficulty(requestedDifficulty) ? requestedDifficulty : rec.difficulty;
    const custom = getCustomScenario(rec.id);
    let rounds: DialogRound[];
    let entryDifficulty: Difficulty = difficulty;
    if (custom) {
      rounds = getCustomRounds(custom, difficulty);
    } else {
      const dialogs = getDialogsForScenario(rec.scenario_id);
      const entry = dialogs.find((d) => d.difficulty === difficulty) ?? dialogs[0];
      rounds = entry?.rounds ?? [];
      if (entry) entryDifficulty = entry.difficulty;
    }
    if (rounds.length === 0) {
      return c.json({ items: [] });
    }
    const items = rounds
      .map((r) => {
        const text = r.ai_message ?? '';
        if (!text) return null;
        return {
          id: String(r.round),
          text,
          translation: r.ai_message_zh,
          difficulty: entryDifficulty,
        };
      })
      .filter((p): p is { id: string; text: string; translation: string; difficulty: Difficulty } => p !== null);
    return c.json({ items });
  } catch (err) {
    return c.json(
      { error: { code: 'PROMPTS_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

// POST /api/sessions/:id/messages  — single-turn flow
sessionsRoutes.post('/api/sessions/:id/messages', async (c) => {
  const id = c.req.param('id');
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: `session '${id}' not found` } }, 404);
  }
  if (rec.status === 'completed') {
    return c.json({ error: { code: 'SESSION_COMPLETED', message: 'session is already completed' } }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  let userText = typeof body.content === 'string' ? body.content.trim() : '';
  const effectiveMode: SessionMode = isValidMode(body.mode) ? body.mode : rec.mode;
  const mm = getMiniMaxEnv(c.env);

  // If audio_base64 is provided, run ASR first.
  if (!userText && typeof body.audio_base64 === 'string' && body.audio_base64.length > 0) {
    try {
      const bin = atob(body.audio_base64);
      const audio = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) audio[i] = bin.charCodeAt(i);
      const asr = await transcribeBuffer(mm, audio, { language: 'en' });
      userText = (asr.text ?? '').trim();
      if (!userText) userText = '(no speech detected)';
    } catch (err) {
      userText = '(asr failed: ' + (err as Error).message + ')';
    }
  }

  if (!userText) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'content or audio_base64 is required' } },
      400,
    );
  }

  try {
    const userMsg = await appendMessage(c.env.DB, id, { role: 'user', content: userText });
    const priorMessages = (await getMessages(c.env.DB, id)).filter((m) => m.id !== userMsg.id);
    const llmContext = toLlmContext(priorMessages);
    const custom = getCustomScenario(id);
    const targetForRound = (): DialogRound | null =>
      custom
        ? getCustomDialogForRound(custom, rec.difficulty, rec.round_index)
        : getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index);

    let score: ScoreFeedback;
    if (effectiveMode === 'repeat') {
      const target = targetForRound()?.ai_message ?? '';
      score = scoreRepeat(target, userText);
    } else {
      score = await scoreWithLlm(mm, userText, llmContext);
    }

    // Persist score on the user message row.
    try {
      await runAsync(
        c.env.DB,
        `UPDATE messages SET score = ?, fluency = ?, accuracy = ?, feedback_json = ? WHERE id = ?`,
        [
          score.overall_score,
          score.fluency,
          score.accuracy,
          JSON.stringify(score),
          userMsg.id,
        ],
      );
      userMsg.score = score.overall_score;
      userMsg.fluency = score.fluency;
      userMsg.accuracy = score.accuracy;
      userMsg.feedback_json = JSON.stringify(score);
    } catch {
      // best-effort
    }

    // Generate AI reply.
    let aiMessage = '';
    let audioUrl: string | null = null;
    if (effectiveMode === 'repeat') {
      const target = targetForRound()?.ai_message ?? '';
      aiMessage =
        score.overall_score >= 80
          ? `Great job! You said: "${userText}". Let's move to the next sentence.`
          : `Good try. The target was: "${target}". Please listen and try again.`;
    } else {
      const systemPrompt = buildConversationSystemPrompt(custom?.system_prompt ?? getSystemPrompt(rec.difficulty));
      const contextMessages: LlmChatMessage[] = [
        ...llmContext,
        { role: 'user', content: userText },
      ];
      try {
        const resp = await chatCompletion(mm, {
          system: systemPrompt,
          messages: contextMessages,
          temperature: 0.7,
          maxTokens: 350,
        });
        aiMessage = (resp.content ?? '').trim() || '(empty AI reply)';
      } catch (err) {
        aiMessage = `(AI unavailable: ${(err as Error).message})`;
      }
    }

    // TTS + R2 save.
    if (aiMessage && aiMessage.length > 0) {
      try {
        const tts = await textToAudio(mm, { text: aiMessage, voiceId: TTS_DEFAULT_VOICE });
        if (!tts.mocked) {
          const url = await saveAudioForSession(c.env, id, tts.audio, tts.mime);
          audioUrl = url || null;
        }
      } catch {
        // best-effort
      }
    }

    const aiMsg = await appendMessage(c.env.DB, id, { role: 'assistant', content: aiMessage, audioUrl });
    await advanceRound(c.env.DB, id);

    return c.json({
      user_message: {
        id: userMsg.id,
        content: userMsg.content,
        created_at: userMsg.created_at,
      },
      ai_message: aiMsg.content,
      ai_audio_url: aiMsg.audio_url,
      score,
      round_index: rec.round_index,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ error: { code: err.code, message: err.message } }, 400);
    }
    if (err instanceof NotFoundError) {
      return c.json({ error: { code: err.code, message: err.message } }, 404);
    }
    return c.json({ error: { code: 'MESSAGE_FAILED', message: (err as Error).message } }, 500);
  }
});

// POST /api/sessions/:id/transcribe — ASR-only helper
sessionsRoutes.post('/api/sessions/:id/transcribe', async (c) => {
  const id = c.req.param('id');
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: `session '${id}' not found` } }, 404);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.audio_base64 !== 'string' || body.audio_base64.length === 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'audio_base64 is required' } }, 400);
  }
  try {
    const mm = getMiniMaxEnv(c.env);
    const bin = atob(body.audio_base64);
    const audio = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) audio[i] = bin.charCodeAt(i);
    const result = await transcribeBuffer(mm, audio, { language: 'en' });
    return c.json({ text: result.text, confidence: result.confidence, mocked: result.mocked });
  } catch (err) {
    return c.json({ error: { code: 'TRANSCRIBE_FAILED', message: (err as Error).message } }, 500);
  }
});

// POST /api/sessions/:id/feedback — explicit end-of-session feedback
sessionsRoutes.post('/api/sessions/:id/feedback', async (c) => {
  const id = c.req.param('id');
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: `session '${id}' not found` } }, 404);
  }
  try {
    const messages = await getMessages(c.env.DB, id);
    const userTurns = messages.filter((m) => m.role === 'user');
    const userTexts = userTurns.map((m) => m.content).filter((t) => t && t.trim().length > 0);

    if (userTexts.length === 0) {
      return c.json({ error: { code: 'NO_USER_TURNS', message: 'session has no user turns yet' } }, 400);
    }

    const perTurnScores = userTurns
      .map((m) => (typeof m.score === 'number' ? m.score : null))
      .filter((s): s is number => s !== null);
    const baseOverall =
      perTurnScores.length > 0
        ? Math.round(perTurnScores.reduce((a, b) => a + b, 0) / perTurnScores.length)
        : null;

    const mm = getMiniMaxEnv(c.env);
    const custom = getCustomScenario(id);
    const systemPrompt = buildConversationSystemPrompt(custom?.system_prompt ?? getSystemPrompt(rec.difficulty));
    const llmMessages: LlmChatMessage[] = [
      ...toLlmContext(messages),
      {
        role: 'user',
        content:
          'Please give me a final overall feedback for this practice session. ' +
          'Return STRICT JSON with overall_score, fluency, accuracy, key_issues (up to 3), suggestion.',
      },
    ];
    let finalFeedback: ScoreFeedback | null = null;
    try {
      const resp = await chatCompletion(mm, {
        system: systemPrompt,
        messages: llmMessages,
        temperature: 0.3,
        maxTokens: 500,
        responseFormatJson: true,
      });
      finalFeedback = safeParseScore(resp.content);
    } catch {
      /* ignore */
    }

    if (!finalFeedback) {
      finalFeedback = {
        overall_score: baseOverall ?? 70,
        fluency: baseOverall ?? 70,
        accuracy: baseOverall ?? 70,
        key_issues:
          perTurnScores.length === 0
            ? ['No scored turns yet — try a few practice rounds.']
            : ['Overall performance aggregated from your turns.'],
        suggestion: 'Review the key phrases of this scenario, then try the session once more.',
      };
    }

    return c.json({
      session_id: id,
      feedback: finalFeedback,
      per_turn_scores: perTurnScores,
      user_turn_count: userTurns.length,
      duration_sec:
        rec.ended_at !== null
          ? Math.max(0, Math.round((rec.ended_at - rec.started_at) / 1000))
          : Math.max(0, Math.round((Date.now() - rec.started_at) / 1000)),
    });
  } catch (err) {
    return c.json({ error: { code: 'FEEDBACK_FAILED', message: (err as Error).message } }, 500);
  }
});

// POST /api/sessions/:id/complete
sessionsRoutes.post('/api/sessions/:id/complete', async (c) => {
  const id = c.req.param('id');
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: 'SESSION_NOT_FOUND', message: `session '${id}' not found` } }, 404);
  }
  if (rec.status === 'completed') {
    return c.json({ error: { code: 'SESSION_COMPLETED', message: 'session is already completed' } }, 409);
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const totalScore =
    typeof body.total_score === 'number' && Number.isFinite(body.total_score)
      ? Math.max(0, Math.min(100, Math.round(body.total_score)))
      : null;
  try {
    const result = await completeSession(c.env.DB, id, totalScore);
    if (!result) {
      return c.json({ error: { code: 'SESSION_COMPLETE_FAILED', message: 'unknown error' } }, 500);
    }
    const finalMessages = (await getMessages(c.env.DB, id)).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      audio_url: m.audio_url ?? null,
      score: m.score ?? null,
      fluency: m.fluency ?? null,
      accuracy: m.accuracy ?? null,
      created_at: m.created_at,
    }));
    return c.json({
      session_id: id,
      status: 'completed',
      ended_at: rec.ended_at,
      total_score: rec.total_score,
      duration_sec: result.durationSec,
      message_count: result.messageCount,
      messages: finalMessages,
    });
  } catch (err) {
    return c.json({ error: { code: 'SESSION_COMPLETE_FAILED', message: (err as Error).message } }, 500);
  }
});

// GET /api/tts/voices — available MiniMax voices
sessionsRoutes.get('/api/tts/voices', (c) => {
  return c.json({ voices: TTS_VOICES, default_voice_id: TTS_DEFAULT_VOICE });
});

// POST /api/tts — public TTS utility
sessionsRoutes.post('/api/tts', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === 'string' ? body.text : '';
  if (!text.trim()) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'text is required' } }, 400);
  }
  const voiceId = typeof body.voice_id === 'string' ? body.voice_id : TTS_DEFAULT_VOICE;
  const speed = typeof body.speed === 'number' ? body.speed : 1.0;
  try {
    const mm = getMiniMaxEnv(c.env);
    const tts = await textToAudio(mm, { text, voiceId, speed });
    const bytes = new Uint8Array(tts.audio);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const audio_base64 = btoa(binary);
    if (tts.mocked) {
      return c.json({
        mocked: true,
        audio_base64,
        mime: tts.mime,
        note: 'TTS is in mock mode (no MiniMax credentials). Front-end can attempt playback (will be silent).',
      });
    }
    return c.json({ mocked: false, audio_base64, mime: tts.mime });
  } catch (err) {
    return c.json({ error: { code: 'TTS_FAILED', message: (err as Error).message } }, 500);
  }
});
