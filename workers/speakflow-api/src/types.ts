/**
 * Shared types between routes, services, and WebSocket layer.
 * Keep this file dependency-free.
 * (Mirrored from backend/src/types.ts — keep in sync if changed.)
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type SessionMode = 'free' | 'repeat';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ScenarioMeta {
  id: string;
  title_zh: string;
  title_en: string;
  icon: string;
  description_zh: string;
  difficulty_levels: Difficulty[];
  ai_role: string;
  user_role: string;
  key_skills: string[];
}

export interface DialogRound {
  round: number;
  ai_message: string;
  ai_message_zh: string;
  expected_user_response_hint: string;
  key_phrases: string[];
  common_mistakes: string;
  tips_zh: string;
}

export interface ScenarioDialogs {
  scenario_id: string;
  difficulty: Difficulty;
  rounds: DialogRound[];
}

export interface VocabularyEntry {
  term: string;
  full_form?: string;
  category: string;
  phonetic?: string;
  definition_en: string;
  definition_zh: string;
  example: string;
}

export interface CustomDialogRound extends DialogRound {
  user_response_example?: string;
}

export interface CustomScenarioDialogs {
  beginner: CustomDialogRound[];
  intermediate: CustomDialogRound[];
  advanced: CustomDialogRound[];
}

export interface CustomVocabularyEntry {
  term: string;
  full_form?: string;
  phonetic?: string;
  definition_en: string;
  definition_zh: string;
  example: string;
}

export interface CustomScenario {
  id: string;
  name: string;
  keywords: string[];
  title_zh: string;
  title_en: string;
  description_zh: string;
  description_en: string;
  vocabulary: CustomVocabularyEntry[];
  dialogs: CustomScenarioDialogs;
  system_prompt: string;
  created_at: number;
}

export interface ScoreFeedback {
  overall_score: number;
  fluency: number;
  accuracy: number;
  key_issues: string[];
  suggestion: string;
}

export interface LlmChatMessage {
  role: MessageRole;
  content: string;
}

export interface LlmChatRequest {
  system: string;
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
}

export interface LlmChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  mocked: boolean;
}

export interface TtsRequest {
  text: string;
  voiceId?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'pcm';
  sampleRate?: number;
}

export interface TtsResponse {
  /** Raw audio bytes (mp3 by default). */
  audio: ArrayBuffer;
  mime: string;
  mocked: boolean;
}

export interface AsrFinalResult {
  text: string;
  confidence?: number;
  language?: string;
  mocked: boolean;
}

export interface SessionRecord {
  id: string;
  scenario_id: string;
  difficulty: Difficulty;
  mode: SessionMode;
  started_at: number;
  ended_at: number | null;
  total_score: number | null;
  status: 'active' | 'completed';
  round_index: number;
}

export interface MessageRecord {
  id: number;
  session_id: string;
  role: MessageRole;
  content: string;
  audio_url: string | null;
  score: number | null;
  fluency: number | null;
  accuracy: number | null;
  feedback_json: string | null;
  created_at: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface WebSocketEnvelope<T = unknown> {
  type: string;
  payload?: T;
  ts: number;
}

export interface WsClientToServer {
  type: 'audio_chunk' | 'audio_end' | 'text' | 'ping' | 'request_tts' | 'config';
  payload?: unknown;
}

export interface WsServerToClient {
  type:
    | 'ready'
    | 'transcript_partial'
    | 'transcript_final'
    | 'ai_message'
    | 'ai_audio_url'
    | 'ai_audio_chunk'
    | 'score'
    | 'error'
    | 'pong'
    | 'session_state';
  payload?: unknown;
  ts: number;
}
