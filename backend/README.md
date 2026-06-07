# speakly-backend

Node.js + TypeScript + Fastify backend for the English speaking practice app.
Pairs with the [Vue 3 frontend](../frontend) and consumes the [scenario / dialog / vocabulary content](../content).

## Features

- **Fastify 4** HTTP server (port 3001) with strict-mode TypeScript.
- **better-sqlite3** persistence with idempotent auto-migrations (no external DB needed).
- **MiniMax voice-model integration**: text chat, TTS (`t2a_v2`), real-time ASR (WebSocket stream).
- **Graceful mock fallback** when `MINIMAX_API_KEY` is empty — the service still starts and returns deterministic mock data, perfect for local front-end dev.
- **WebSocket** real-time voice dialogue: `browser → ASR → LLM → TTS → browser`.
- **CORS** open to `localhost:5173` by default.
- **Scoring** done by the LLM with a JSON-only system prompt; deterministic Jaccard-similarity scoring for repeat-mode targets.
- **6 fixed scenarios** (phone meeting, inquiry & quote, factory audit, logistics, sample development, claim / after-sales) with three difficulty levels each.

## Quick start

```bash
cd /workspace/backend
cp .env.example .env        # then fill in MINIMAX_API_KEY / MINIMAX_GROUP_ID
npm install
npm run dev                 # ts-node-dev with hot reload
```

If you do not fill in `MINIMAX_API_KEY`, the service still starts and warns loudly.
The smoke test below shows the mock-mode behaviour.

### Health check

```bash
curl http://localhost:3001/health
# { "ok": true, "ts": 1700000000000, "minimax": { "hasCredentials": false } }
```

### Seed vocabulary

```bash
npm run seed                # imports /workspace/content/vocabulary.json into vocabulary_progress
```

### Build for production

```bash
npm run build               # tsc → dist/
npm start                   # node dist/src/index.js
```

## Environment variables

| Variable           | Default                              | Notes                                                                                    |
|--------------------|--------------------------------------|------------------------------------------------------------------------------------------|
| `PORT`             | `3001`                               | HTTP listen port                                                                         |
| `HOST`             | `0.0.0.0`                            | Bind address                                                                             |
| `LOG_LEVEL`        | `info`                               | `debug` / `info` / `warn` / `error`                                                      |
| `CORS_ORIGINS`     | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list; `*` allows all                                              |
| `MINIMAX_API_KEY`  | _empty_                              | Leave empty for mock mode                                                                |
| `MINIMAX_GROUP_ID` | _empty_                              | Required for some MiniMax endpoints                                                      |
| `API_BASE`         | `https://api.minimax.chat`           | Override for proxy / staging                                                             |
| `CONTENT_DIR`      | `/workspace/content`                 | Where scenarios / dialogs / vocabulary / system_prompts live                             |
| `DB_PATH`          | `<project>/data/app.db`              | SQLite file path                                                                         |

## HTTP API

All responses are JSON. Errors use the shape `{ "error": { "code": "...", "message": "..." } }`.

| Method | Path                              | Purpose                                                                                        |
|--------|-----------------------------------|------------------------------------------------------------------------------------------------|
| GET    | `/health`                         | `{ ok, ts, minimax.hasCredentials }`                                                           |
| GET    | `/api/scenarios`                  | List all 6 scenarios                                                                           |
| GET    | `/api/scenarios/:id`              | Single scenario + all its dialog scripts                                                       |
| POST   | `/api/sessions`                   | Create a practice session. Body: `{ scenario_id, difficulty, mode }`                           |
| GET    | `/api/sessions/:id`               | Session state + message_count + avg_score                                                      |
| POST   | `/api/sessions/:id/messages`      | User says a line. Body: `{ content, mode?, audio_base64? }` → AI reply + score + audio URL     |
| POST   | `/api/sessions/:id/transcribe`    | ASR-only helper. Body: `{ audio_base64 }` → `{ text, confidence, mocked }`                      |
| POST   | `/api/sessions/:id/feedback`      | End-of-session holistic feedback. Body: `{}` → `{ feedback: ScoreFeedback, per_turn_scores }`  |
| POST   | `/api/sessions/:id/complete`      | Mark session done. Body: `{ total_score? }`                                                    |
| GET    | `/api/history`                    | List past sessions (with `limit` / `offset`)                                                   |
| GET    | `/api/history/:id`                | Detailed session + scenario + all messages                                                     |
| GET    | `/api/stats`                      | Aggregated stats: total sessions, avg score, by-scenario, by-difficulty, recent, vocabulary   |
| POST   | `/api/tts`                        | Convenience TTS. Body: `{ text, voice_id?, speed? }` → `{ mocked, audio_base64, mime }`        |

### Score payload shape

```json
{
  "overall_score": 78,
  "fluency": 80,
  "accuracy": 76,
  "key_issues": [
    "Mind the article usage: \"I am sales manager\" needs \"a sales manager\".",
    "Use past simple for completed actions, not present perfect.",
    "Watch the preposition: \"interested for\" should be \"interested in\"."
  ],
  "suggestion": "Read the sentence aloud once before sending; small prepositions often slip."
}
```

## WebSocket protocol

Endpoint: `ws://localhost:3001/ws/session/:id` (Fastify WebSocket).

All envelopes share the shape `{ type, payload?, ts }`. Server → client events include `ts`; client → server messages may omit it.

### Client → server

| `type`         | `payload`                          | Meaning                                                   |
|----------------|------------------------------------|-----------------------------------------------------------|
| `ping`         | —                                  | keep-alive; server replies `pong`                         |
| `config`       | `{ language?, sample_rate? }`      | reserved for future ASR options                           |
| `audio_chunk`  | `{ audio_base64: string }`         | push one recorded frame                                   |
| `audio_end`    | —                                  | flush ASR and trigger a turn (if transcript is non-empty) |
| `text`         | `{ content: string }`              | bypass ASR — type fallback                                |
| `request_tts`  | `{ text: string, voice_id? }`      | server returns `ai_audio_chunk`                           |

### Server → client

| `type`               | `payload`                                       | Meaning                                          |
|----------------------|-------------------------------------------------|--------------------------------------------------|
| `ready`              | `{ session_id, difficulty, mode }`              | emitted immediately on open                      |
| `transcript_partial` | `{ text }`                                      | live partial transcript                           |
| `transcript_final`   | `{ text, confidence?, mocked, language?, note? }` | committed transcript                            |
| `score`              | `ScoreFeedback`                                 | result of the just-completed turn                |
| `ai_message`         | `{ content, audio_url?, audio_base64?, audio_mime?, mocked, round_index }` | AI reply (mock or real)  |
| `ai_audio_url`       | `{ url }`                                       | convenience: separate frame for the audio URL    |
| `ai_audio_chunk`     | `{ audio_base64, mime, mocked }`                | inline TTS bytes (used by `request_tts` and in mock mode) |
| `session_state`      | `{ session_id, round_index, last_user_message_id, last_ai_message_id }` | end-of-turn bookkeeping |
| `error`              | `{ code, message }`                             | recoverable error — client should surface to UI  |
| `pong`               | —                                               | reply to `ping`                                  |

### Audio lifecycle

1. Client opens socket, receives `ready`.
2. Client streams `audio_chunk` frames, optionally receiving `transcript_partial` updates.
3. Client sends `audio_end` → server emits `transcript_final` and runs the turn.
4. Server emits `score` → `ai_message` → `ai_audio_url` / `ai_audio_chunk` → `session_state`.
5. On socket close, the server tears down the in-flight ASR session.

## Mock fallback

When `MINIMAX_API_KEY` is empty, all three voice-model clients short-circuit to deterministic mocks:

- **LLM**: scoring returns a fixed sample `ScoreFeedback` (overall 78 / fluency 80 / accuracy 76); free-conversation replies echo the user's last message wrapped in `(mock AI) ...`.
- **TTS**: returns a 16-byte silent MP3 frame header (front-end can still call `<audio>.play()`; the user will hear silence — the explicit signal that mocks are on).
- **ASR**: WebSocket `audio_end` returns `transcript_final { text: "", mocked: true, note: "ASR in mock mode; type your reply instead." }` — the client is expected to fall back to the `text` envelope.

The LLM is always invoked for scoring in mock mode too (so the JSON-format / system-prompt path is exercised end-to-end even without credentials). The LLM call goes to a function that returns the mock JSON directly, so no external network call is made.

## Database

SQLite, file at `data/app.db` (auto-created on first run). Schema:

- `sessions(id PK, scenario_id, difficulty, mode, started_at, ended_at?, total_score?, status, round_index)`
- `messages(id PK, session_id FK, role, content, audio_url?, score?, fluency?, accuracy?, feedback_json?, created_at)`
- `vocabulary_progress(id PK, term UNIQUE, correct_count, wrong_count, last_seen)`

Migrations are applied on every boot and are idempotent (CREATE TABLE IF NOT EXISTS).

## Project layout

```
backend/
  package.json
  tsconfig.json
  .env.example
  data/                 ← runtime: app.db + audio/
  scripts/
    seed-vocabulary.ts
  src/
    index.ts            ← entry
    config.ts           ← env loading
    db.ts               ← sqlite + migrations
    types.ts            ← shared types
    routes/
      scenarios.ts
      sessions.ts
      history.ts
      stats.ts
    services/
      content.ts        ← reads /workspace/content + in-memory defaults
      minimax-llm.ts    ← chatcompletion_v2 wrapper
      minimax-tts.ts    ← t2a_v2 wrapper
      minimax-asr.ts    ← real-time ASR WebSocket client
      scoring.ts        ← LLM scoring + repeat-mode string similarity
      session-manager.ts ← DB + cache for sessions and messages
    ws/
      session-ws.ts     ← /ws/session/:id
    utils/
      logger.ts
```

## Known limitations

- The MiniMax ASR WebSocket contract is based on common streaming-ASR conventions; if the real endpoint's auth / message schema differ, the `AsrSession` class is the only place to tweak.
- TTS in mock mode produces silence, not text-to-speech audio, so the front-end should surface a "Mock mode active" banner.
- Repeat-mode scoring uses word-set Jaccard similarity — it intentionally avoids external NLP. For phoneme-level accuracy, integrate a pronunciation-scoring API later.
- `CORS_ORIGINS` is permissive in dev; production deployments should set explicit origins.
- The CORS plugin accepts any origin in dev (`cb(null, true)` after the explicit check) to avoid blocking the front-end during the integration sprint — tighten via env for production.
- No authentication / multi-tenancy: all sessions are anonymous. Add a `user_id` column and JWT middleware when needed.
