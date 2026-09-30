/**
 * Shared VYORA frontend types.
 *
 * This frontend talks to a local Python FastAPI backend. No hosted services.
 */

export type AssistantState =
  | "disconnected"
  | "ready"
  | "loading-model"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "stopped"
  | "error";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Plain text only. Rendered escaped — never as HTML. */
  text: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export interface SystemTelemetry {
  cpuPercent: number;
  ramPercent: number;
  batteryPercent: number | null;
  batteryCharging: boolean | null;
  ramUsedGb?: number;
  ramTotalGb?: number;
}

export interface BackendStatus {
  connected: boolean;
  backendVersion: string | null;
  aiModel: { name: string; loaded: boolean } | null;
  speechModel: { name: string; downloaded: boolean; sizeMb: number | null } | null;
  /** Local AI runtime answered (real backend only). */
  aiReachable?: boolean;
  busy?: boolean;
  voiceStage?: string | null;
  speaking?: boolean;
  speechError?: string | null;
}

export interface MicrophoneDevice {
  id: string;
  label: string;
}

export type RecordingSeconds = 4 | 6 | 10 | 15;

export interface AssistantSettings {
  spokenReplies: boolean;
  microphoneId: string | null;
  recordingSeconds: RecordingSeconds;
}

export interface TranscriptResult {
  transcript: string;
  cancelled?: boolean;
}

export interface AssistantReply {
  reply: string;
  savedNote?: Note;
  cancelled?: boolean;
  source?: string;
}

/**
 * The single typed surface every backend call goes through.
 * Swap the mock implementation for the real FastAPI client once the API lands.
 */
export interface VyoraService {
  /** True when this implementation serves sample data. */
  readonly isDemo: boolean;
  /** Whether the frontend may trigger a speech model download. */
  readonly canDownloadSpeechModel: boolean;
  createConversation(): Promise<Conversation>;
  getMessages(conversationId: string): Promise<ChatMessage[]>;
  /** Ask the backend to stop the active chat/listen/speech operation. */
  stop(): Promise<void>;
  connect(token: string): Promise<BackendStatus>;
  disconnect(): Promise<void>;
  getStatus(): Promise<BackendStatus>;
  getTelemetry(): Promise<SystemTelemetry>;
  listMicrophones(): Promise<MicrophoneDevice[]>;
  listConversations(): Promise<Conversation[]>;
  listNotes(): Promise<Note[]>;
  loadSpeechModel(): Promise<void>;
  /** Python owns audio capture. Resolves with the transcript of the clip. */
  recordAndTranscribe(options: {
    seconds: RecordingSeconds;
    microphoneId: string | null;
    signal?: AbortSignal;
  }): Promise<TranscriptResult>;
  sendMessage(options: {
    conversationId: string;
    text: string;
    signal?: AbortSignal;
    onDelta?: (text: string) => void;
    onState?: (value: string) => void;
  }): Promise<AssistantReply>;
  /** Python owns speech output. Resolves once playback has started (real) or finished (demo). */
  speak(options: { text: string; signal?: AbortSignal }): Promise<void>;
}
