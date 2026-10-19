import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
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
import { chatCompletion, buildConversationSystemPrompt } from '../services/minimax-llm';
import { textToAudio, TTS_DEFAULT_VOICE, TTS_VOICES } from '../services/minimax-tts';
import { transcribeBuffer } from '../services/minimax-asr';
import { scoreWithLlm, scoreRepeat, safeParseScore } from '../services/scoring';
// safeParseScore is internal to scoring.ts and not re-exported; we reuse it via the LLM module
// only for the explicit /feedback path. The /messages path uses scoreWithLlm which already
// handles JSON parsing.
import { getScenarioById, getDialogForRound, getDialogsForScenario, getSystemPrompt } from '../services/content';
import {
  getCustomDialogForRound,
  getCustomRounds,
  getCustomScenario,
  isCustomScenarioId,
  setCustomScenario,
} from '../services/custom-scenarios';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import type {
  ApiErrorBody,
  CustomScenario,
  DialogRound,
  Difficulty,
  LlmChatMessage,
  ScoreFeedback,
  SessionMode,
} from '../types';

const log = createLogger('routes/sessions');

function errBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, details } };
}

function isValidDifficulty(d: unknown): d is Difficulty {
  return d === 'beginner' || d === 'intermediate' || d === 'advanced';
}

function isValidMode(m: unknown): m is SessionMode {
  return m === 'free' || m === 'repeat';
}

interface CreateSessionBody {
  scenario_id?: unknown;
  difficulty?: unknown;
  mode?: unknown;
  custom_scenario?: unknown;
}

interface MessageBody {
  content?: unknown;
  mode?: unknown;
  audio_base64?: unknown;
  mime_type?: unknown;
}

interface FeedbackBody {
  content?: unknown;
}

const sessionsRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  // POST /api/sessions
  app.post<{ Body: CreateSessionBody }>('/api/sessions', async (req, reply) => {
    const body = req.body ?? {};
    if (!body.scenario_id || typeof body.scenario_id !== 'string') {
      return reply.code(400).send(errBody('VALIDATION_ERROR', 'scenario_id is required'));
    }
    if (!isValidDifficulty(body.difficulty)) {
      return reply.code(400).send(errBody('VALIDATION_ERROR', 'difficulty must be beginner|intermediate|advanced'));
    }
    if (!isValidMode(body.mode)) {
      return reply.code(400).send(errBody('VALIDATION_ERROR', 'mode must be free|repeat'));
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
        return reply
          .code(400)
          .send(errBody('VALIDATION_ERROR', 'custom_scenario is required when scenario_id starts with "custom-"'));
      }
      customScenario = cs as CustomScenario;
    } else {
      const scenario = getScenarioById(body.scenario_id);
      if (!scenario) {
        return reply.code(404).send(errBody('SCENARIO_NOT_FOUND', `scenario '${body.scenario_id}' not found`));
      }
    }
    try {
      const rec = createSession({
        scenario_id: body.scenario_id,
        difficulty: body.difficulty,
        mode: body.mode,
      });
      if (customScenario) {
        setCustomScenario(rec.id, customScenario);
      }
      return reply.code(201).send({
        session_id: rec.id,
        scenario_id: rec.scenario_id,
        difficulty: rec.difficulty,
        mode: rec.mode,
        status: rec.status,
        started_at: rec.started_at,
      });
    } catch (err) {
      log.error(`createSession failed: ${(err as Error).message}`);
      return reply.code(500).send(errBody('SESSION_CREATE_FAILED', (err as Error).message));
    }
  });

  // GET /api/sessions/:id
  app.get<{ Params: { id: string } }>('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params;
    try {
      const rec = getSession(id);
      if (!rec) {
        return reply.code(404).send(errBody('SESSION_NOT_FOUND', `session '${id}' not found`));
      }
      const messages = getMessages(id);
      const userTurns = messages.filter((m) => m.role === 'user');
      const scoresArr = userTurns
        .map((m) => (typeof m.score === 'number' ? m.score : null))
        .filter((s): s is number => s !== null);
      const avgScore =
        scoresArr.length > 0 ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length) : null;
      return reply.send({
        ...rec,
        message_count: messages.length,
        user_turn_count: userTurns.length,
        avg_score: avgScore,
      });
    } catch (err) {
      return reply.code(500).send(errBody('SESSION_FETCH_FAILED', (err as Error).message));
    }
  });

  // GET /api/sessions/:id/prompts  — return the per-round follow-along
  // targets for this session's scenario+difficulty. The front-end issues
  // this as a forward-compat probe (it falls back to /api/scenarios/:id
  // dialogs on 4xx); implementing the endpoint here turns a 404 (which
  // triggers a browser-side "Failed to load resource" console error) into
  // a clean 200, and also gives the front-end a session-scoped view of
  // prompts in case the dialog store is later keyed differently.
  app.get<{ Params: { id: string }; Querystring: { difficulty?: string } }>(
    '/api/sessions/:id/prompts',
    async (req, reply) => {
      try {
        const rec = getSession(req.params.id);
        if (!rec) {
          return reply.code(404).send(errBody('SESSION_NOT_FOUND', `session '${req.params.id}' not found`));
        }
        const requestedDifficulty = req.query?.difficulty;
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
          return reply.send({ items: [] });
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
        return reply.send({ items });
      } catch (err) {
        return reply.code(500).send(errBody('PROMPTS_FAILED', (err as Error).message));
      }
    },
  );

  // POST /api/sessions/:id/messages
  app.post<{ Params: { id: string }; Body: MessageBody }>(
    '/api/sessions/:id/messages',
    async (req, reply) => {
      const { id } = req.params;
      const rec = getSession(id);
      if (!rec) {
        return reply.code(404).send(errBody('SESSION_NOT_FOUND', `session '${id}' not found`));
      }
      if (rec.status === 'completed') {
        return reply.code(409).send(errBody('SESSION_COMPLETED', 'session is already completed'));
      }

      const body = req.body ?? {};
      let userText = typeof body.content === 'string' ? body.content.trim() : '';
      const effectiveMode: SessionMode = isValidMode(body.mode) ? body.mode : rec.mode;

      // If audio_base64 is provided, run ASR first to get the text.
      if (!userText && typeof body.audio_base64 === 'string' && body.audio_base64.length > 0) {
        try {
          const audio = Buffer.from(body.audio_base64, 'base64');
          const asr = await transcribeBuffer(audio, { language: 'en' });
          userText = (asr.text ?? '').trim();
          if (!userText) {
            log.warn('ASR returned empty transcript; falling back to placeholder');
            userText = '(no speech detected)';
          }
        } catch (err) {
          log.warn(`ASR in /messages failed: ${(err as Error).message}`);
          userText = '(asr failed)';
        }
      }

      if (!userText) {
        return reply.code(400).send(errBody('VALIDATION_ERROR', 'content or audio_base64 is required'));
      }

      try {
        // 1) Save the user message.
        const userMsg = appendMessage(id, { role: 'user', content: userText });

        // 2) Score it.
        const llmContext = toLlmContext(getMessages(id).filter((m) => m.id !== userMsg.id));
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
          score = await scoreWithLlm(userText, llmContext);
        }

        // Persist score on the user message row.
        try {
          getDb()
            .prepare(`UPDATE messages SET score = ?, fluency = ?, accuracy = ?, feedback_json = ? WHERE id = ?`)
            .run(score.overall_score, score.fluency, score.accuracy, JSON.stringify(score), userMsg.id);
          userMsg.score = score.overall_score;
          userMsg.fluency = score.fluency;
          userMsg.accuracy = score.accuracy;
          userMsg.feedback_json = JSON.stringify(score);
        } catch (err) {
          log.warn(`Failed to persist score: ${(err as Error).message}`);
        }

        // 3) Generate the AI reply.
        let aiMessage = '';
        let audioUrl: string | null = null;
        if (effectiveMode === 'repeat') {
          // In repeat mode the AI just confirms / prompts the next sentence.
          const target = targetForRound()?.ai_message ?? '';
          if (score.overall_score >= 80) {
            aiMessage = `Great job! You said: "${userText}". Let's move to the next sentence.`;
          } else {
            aiMessage = `Good try. The target was: "${target}". Please listen and try again.`;
          }
        } else {
          const systemPrompt = buildConversationSystemPrompt(custom?.system_prompt ?? getSystemPrompt(rec.difficulty));
          const contextMessages: LlmChatMessage[] = [
            ...llmContext,
            { role: 'user', content: userText },
          ];
          try {
            const resp = await chatCompletion({
              system: systemPrompt,
              messages: contextMessages,
              temperature: 0.7,
              maxTokens: 350,
            });
            aiMessage = (resp.content ?? '').trim() || '(empty AI reply)';
          } catch (err) {
            log.warn(`AI reply generation failed: ${(err as Error).message}`);
            aiMessage = `(AI unavailable: ${(err as Error).message})`;
          }
        }

        // 4) Synthesise TTS (best-effort, mock if creds missing).
        if (aiMessage && aiMessage.length > 0) {
          try {
            const tts = await textToAudio({ text: aiMessage, voiceId: TTS_DEFAULT_VOICE });
            if (!tts.mocked) {
              audioUrl = await saveAudioForSession(id, tts.audio, tts.mime);
            }
          } catch (err) {
            log.warn(`TTS failed: ${(err as Error).message}`);
          }
        }

        // 5) Persist the AI message and advance the round.
        const aiMsg = appendMessage(id, { role: 'assistant', content: aiMessage, audioUrl });
        advanceRound(id);

        return reply.send({
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
          return reply.code(400).send(errBody(err.code, err.message));
        }
        log.error(`POST /messages failed: ${(err as Error).message}`);
        return reply.code(500).send(errBody('MESSAGE_FAILED', (err as Error).message));
      }
    },
  );

  // POST /api/sessions/:id/transcribe  (helper: ASR only, useful for the front-end to split concerns)
  app.post<{ Params: { id: string }; Body: { audio_base64?: unknown; mime_type?: unknown } }>(
    '/api/sessions/:id/transcribe',
    async (req, reply) => {
      const { id } = req.params;
      const rec = getSession(id);
      if (!rec) {
        return reply.code(404).send(errBody('SESSION_NOT_FOUND', `session '${id}' not found`));
      }
      const body = req.body ?? {};
      if (typeof body.audio_base64 !== 'string' || body.audio_base64.length === 0) {
        return reply.code(400).send(errBody('VALIDATION_ERROR', 'audio_base64 is required'));
      }
      try {
        const audio = Buffer.from(body.audio_base64, 'base64');
        const result = await transcribeBuffer(audio, { language: 'en' });
        return reply.send({ text: result.text, confidence: result.confidence, mocked: result.mocked });
      } catch (err) {
        return reply.code(500).send(errBody('TRANSCRIBE_FAILED', (err as Error).message));
      }
    },
  );

  // POST /api/sessions/:id/feedback  — explicit end-of-session feedback
  app.post<{ Params: { id: string }; Body: FeedbackBody }>(
    '/api/sessions/:id/feedback',
    async (req, reply) => {
      const { id } = req.params;
      const rec = getSession(id);
      if (!rec) {
        return reply.code(404).send(errBody('SESSION_NOT_FOUND', `session '${id}' not found`));
      }
      try {
        const messages = getMessages(id);
        const userTurns = messages.filter((m) => m.role === 'user');
        const userTexts = userTurns.map((m) => m.content).filter((t) => t && t.trim().length > 0);

        if (userTexts.length === 0) {
          return reply.code(400).send(errBody('NO_USER_TURNS', 'session has no user turns yet'));
        }

        // Average the existing per-turn scores as the primary signal.
        const perTurnScores = userTurns
          .map((m) => (typeof m.score === 'number' ? m.score : null))
          .filter((s): s is number => s !== null);
        const baseOverall =
          perTurnScores.length > 0
            ? Math.round(perTurnScores.reduce((a, b) => a + b, 0) / perTurnScores.length)
            : null;

        // Ask the LLM for a holistic JSON feedback. We always re-score (mock fallback works).
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
          const resp = await chatCompletion({
            system: systemPrompt,
            messages: llmMessages,
            temperature: 0.3,
            maxTokens: 500,
            responseFormatJson: true,
          });
          finalFeedback = safeParseScore(resp.content);
        } catch (err) {
          log.warn(`Final feedback LLM failed: ${(err as Error).message}`);
        }

        if (!finalFeedback) {
          finalFeedback = {
            overall_score: baseOverall ?? 70,
            fluency: baseOverall ?? 70,
            accuracy: baseOverall ?? 70,
            key_issues: perTurnScores.length === 0
              ? ['No scored turns yet — try a few practice rounds.']
              : ['Overall performance aggregated from your turns.'],
            suggestion: 'Review the key phrases of this scenario, then try the session once more.',
          };
        }

        return reply.send({
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
        log.error(`POST /feedback failed: ${(err as Error).message}`);
        return reply.code(500).send(errBody('FEEDBACK_FAILED', (err as Error).message));
      }
    },
  );

  // POST /api/sessions/:id/complete
  app.post<{ Params: { id: string }; Body: { total_score?: unknown } }>(
    '/api/sessions/:id/complete',
    async (req, reply) => {
      const { id } = req.params;
      const rec = getSession(id);
      if (!rec) {
        return reply.code(404).send(errBody('SESSION_NOT_FOUND', `session '${id}' not found`));
      }
      if (rec.status === 'completed') {
        return reply.code(409).send(errBody('SESSION_COMPLETED', 'session is already completed'));
      }
      const totalScore =
        typeof req.body?.total_score === 'number' && Number.isFinite(req.body.total_score)
          ? Math.max(0, Math.min(100, Math.round(req.body.total_score)))
          : null;
      try {
        const result = completeSession(id, totalScore);
        if (!result) {
          return reply.code(500).send(errBody('SESSION_COMPLETE_FAILED', 'unknown error'));
        }
        // Include the full message list in the response — the front-end's
        // sessionStore.finish() replaces the entire session with this payload,
        // and the sidebar "本轮摘要" reads `session.messages.length` to render
        // the count. Without this field, the count would reset to 0 right
        // after finishing, even though the messages are still in the DB.
        const finalMessages = getMessages(id).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          audio_url: m.audio_url ?? null,
          score: m.score ?? null,
          fluency: m.fluency ?? null,
          accuracy: m.accuracy ?? null,
          created_at: m.created_at,
        }));
        return reply.send({
          session_id: id,
          status: 'completed',
          ended_at: rec.ended_at,
          total_score: rec.total_score,
          duration_sec: result.durationSec,
          message_count: result.messageCount,
          messages: finalMessages,
        });
      } catch (err) {
        log.error(`POST /complete failed: ${(err as Error).message}`);
        return reply.code(500).send(errBody('SESSION_COMPLETE_FAILED', (err as Error).message));
      }
    },
  );

  // GET /api/tts/voices — available MiniMax voices
  app.get('/api/tts/voices', async (_req, reply) => {
    return reply.send({ voices: TTS_VOICES, default_voice_id: TTS_DEFAULT_VOICE });
  });

  // POST /api/tts  — convenience endpoint for the front-end to synthesise arbitrary text.
  app.post<{ Body: { text?: unknown; voice_id?: unknown; speed?: unknown } }>(
    '/api/tts',
    async (req: FastifyRequest<{ Body: { text?: unknown; voice_id?: unknown; speed?: unknown } }>, reply) => {
      const body = req.body ?? {};
      const text = typeof body.text === 'string' ? body.text : '';
      if (!text.trim()) {
        return reply.code(400).send(errBody('VALIDATION_ERROR', 'text is required'));
      }
      const voiceId = typeof body.voice_id === 'string' ? body.voice_id : TTS_DEFAULT_VOICE;
      const speed = typeof body.speed === 'number' ? body.speed : 1.0;
      try {
        const tts = await textToAudio({ text, voiceId, speed });
        if (tts.mocked) {
          return reply.send({
            mocked: true,
            audio_base64: tts.audio.toString('base64'),
            mime: tts.mime,
            note: 'TTS is in mock mode (no MiniMax credentials). Front-end can attempt playback (will be silent).',
          });
        }
        return reply.send({
          mocked: false,
          audio_base64: tts.audio.toString('base64'),
          mime: tts.mime,
        });
      } catch (err) {
        return reply.code(500).send(errBody('TTS_FAILED', (err as Error).message));
      }
    },
  );
};

// Lazy require to break circular dep (sessions.ts uses getDb here for the score UPDATE).
function getDb(): import('better-sqlite3').Database {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../db').getDb();
}

// Save generated TTS audio into a per-session directory and return a relative URL.
async function saveAudioForSession(
  sessionId: string,
  audio: Buffer,
  mime: string,
): Promise<string> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve(config.dbPath, '..', 'audio', sessionId);
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const full = path.join(dir, filename);
  await fs.promises.writeFile(full, audio);
  const ext = mime.includes('wav') ? 'wav' : 'mp3';
  // Note: filename is the actual file we wrote. We tag it with .mp3 by default; frontend can ignore.
  void ext;
  return `/static/audio/${sessionId}/${filename}`;
}

export default sessionsRoutes;
