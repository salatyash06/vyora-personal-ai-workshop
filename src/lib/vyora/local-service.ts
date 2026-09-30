import { api, streamChat, TOKEN_KEY, type Conversation as ApiConversation, type Note as ApiNote, type Status, type SystemInfo } from "./api";
import type { AssistantReply, BackendStatus, ChatMessage, Conversation, Note, VyoraService } from "./types";

/**
 * Real adapter for the local VYORA FastAPI backend (http://127.0.0.1:8000).
 * Only routes and fields from API.md are used. The token is user-entered and
 * lives in sessionStorage only (read per-request by the supplied `api` client).
 */

interface ApiMessage {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function toStatus(s: Status): BackendStatus {
  return {
    connected: true,
    backendVersion: null,
    aiModel: { name: s.model, loaded: s.model_ready },
    speechModel: { name: "Local speech model", downloaded: s.speech_model_ready, sizeMb: null },
    aiReachable: s.reachable,
    busy: s.busy || s.voice_busy,
    voiceStage: s.voice_stage || null,
    speaking: s.speaking,
    speechError: s.speech_error || null,
  };
}

const toConversation = (c: ApiConversation): Conversation => ({
  id: String(c.id),
  title: c.title,
  updatedAt: c.created_at,
  messages: [],
});

const toNote = (n: ApiNote): Note => ({ id: String(n.id), content: n.content, createdAt: n.created_at });

export function createLocalVyoraService(): VyoraService {
  return {
    isDemo: false,
    canDownloadSpeechModel: false,

    async connect(token) {
      // Validate before storing: only a successful /api/status saves the token.
      const status = await api<Status>("/status", undefined, { token });
      sessionStorage.setItem(TOKEN_KEY, token);
      return toStatus(status);
    },

    async disconnect() {
      sessionStorage.removeItem(TOKEN_KEY);
    },

    async getStatus() {
      return toStatus(await api<Status>("/status"));
    },

    async getTelemetry() {
      const s = await api<SystemInfo>("/system");
      return {
        cpuPercent: s.cpu_percent,
        ramPercent: s.memory_percent,
        ramUsedGb: s.memory_used_gb,
        ramTotalGb: s.memory_total_gb,
        batteryPercent: s.battery_percent,
        batteryCharging: s.plugged_in,
      };
    },

    async listMicrophones() {
      const devices = await api<{ id: number; name: string }[]>("/audio/devices");
      return devices.map((d) => ({ id: String(d.id), label: d.name }));
    },

    async listConversations() {
      return (await api<ApiConversation[]>("/conversations")).map(toConversation);
    },

    async createConversation() {
      return toConversation(await api<ApiConversation>("/conversations", {}));
    },

    async getMessages(conversationId) {
      const rows = await api<ApiMessage[]>(`/conversations/${encodeURIComponent(conversationId)}/messages`);
      return rows.map<ChatMessage>((m) => ({ id: String(m.id), role: m.role, text: m.content, createdAt: m.created_at }));
    },

    async listNotes() {
      return (await api<ApiNote[]>("/notes")).map(toNote);
    },

    async loadSpeechModel() {
      throw new Error("The local backend does not offer a speech model download. Install it on the Python side.");
    },

    async recordAndTranscribe({ seconds, microphoneId }) {
      const device = microphoneId === null || microphoneId === "" ? null : Number(microphoneId);
      // Recording + transcription can exceed the default 10s timeout.
      const result = await api<{ text: string; cancelled: boolean }>(
        "/listen",
        { seconds, device },
        { timeout: (seconds + 120) * 1000 },
      );
      return { transcript: result.text, cancelled: result.cancelled };
    },

    async sendMessage({ conversationId, text, signal, onDelta, onState }): Promise<AssistantReply> {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      let streamed = "";
      try {
        for await (const event of streamChat(Number(conversationId), text, controller.signal)) {
          switch (event.type) {
            case "state":
              onState?.(event.value);
              break;
            case "token":
              streamed += event.text;
              onDelta?.(streamed);
              break;
            case "done":
              return { reply: event.reply, source: event.source };
            case "error":
              throw new Error(event.message);
            case "cancelled":
              return { reply: streamed, cancelled: true };
          }
        }
        throw new Error("The reply stream closed before it finished. The reply was not saved.");
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
    },

    async speak({ text }) {
      await api<{ started: boolean }>("/speak", { text: text.slice(0, 4000) });
    },

    async stop() {
      await api<{ requested: boolean }>("/stop", {});
    },
  };
}
