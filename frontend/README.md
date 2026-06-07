# SpeakFlow Frontend

Vue 3 + Vite + TypeScript + Pinia + Vue Router single-page app for the
英语口语练习 demo.

## Quick start

```bash
npm install
npm run dev    # http://localhost:5173
```

The Vite dev server proxies:

- `GET/POST /api/*`  →  `http://localhost:3001/api/*`
- `WS    /ws/*`     →  `ws://localhost:3001/ws/*`

So the backend should listen on port 3001 during development.

## Scripts

- `npm run dev`        – Vite dev server (HMR, 5173)
- `npm run build`      – type-check + production build into `dist/`
- `npm run preview`    – preview the built bundle
- `npm run type-check` – `vue-tsc --noEmit`

## Pages

| Path | View | Purpose |
| --- | --- | --- |
| `/` | `HomeView` | Hero + recommended scenarios |
| `/scenarios` | `ScenariosView` | All scenarios, searchable, grouped by difficulty |
| `/scenarios/:id/preview` | `ScenarioPreviewView` | Scenario details + start settings |
| `/practice/:id` | `PracticeView` | Free / repeat mode practice with recorder |
| `/history` | `HistoryView` | List of past sessions |
| `/history/:id` | `HistoryDetailView` | Replay of a single session |
| `/stats` | `StatsView` | KPIs + growth curve + distribution |

## Audio pipeline

1. User taps the recorder (`useRecorder`) → `MediaRecorder` records opus/webm.
2. On stop, the blob is uploaded via `POST /api/sessions/:id/audio` (multipart).
   - The backend may return either `{ text }` (transcript only) or a full
     `{ user_message, ai_message, score }` turn.
3. If only a transcript is returned, the frontend follows up with
   `POST /api/sessions/:id/messages { content }` to get the AI reply + score.
4. The AI reply is spoken via `POST /api/tts` (`useTts`).  When the backend has
   no TTS, the view falls back to the browser's `speechSynthesis`.
5. The text composer is always available as a fallback when microphone
   permission is missing.

If the backend exposes a `WebSocket /ws/session/:id` real-time stream, the
client connects via `src/api/ws.ts`; messages are routed through the same
handlers.

## Project layout

```
src/
  api/             axios client + endpoint modules + ws client
  composables/     useRecorder, useTts
  components/      NavBar, ScenarioCard, MessageBubble, RecorderButton,
                   ScoreCard, DifficultySelector, ModeSelector
  stores/          Pinia: session, history, user
  types/api.ts     Backend-mirroring type definitions
  views/           7 page components
  router.ts        Vue Router config
  main.ts          App bootstrap
```

## Styling

TailwindCSS only — no UI library.  Custom palette in `tailwind.config.js`:

- `brand.*` deep blue (primary surface / buttons)
- `accent.*` warm orange (record CTA / call-out)
- `ink.*`   neutral text + background
