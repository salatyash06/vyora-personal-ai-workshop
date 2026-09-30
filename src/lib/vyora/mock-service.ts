import type {
  AssistantReply,
  BackendStatus,
  Conversation,
  MicrophoneDevice,
  Note,
  SystemTelemetry,
  TranscriptResult,
  VyoraService,
} from "./types";

/**
 * DEMO MODE adapter.
 *
 * Every value here is sample data, never live telemetry. The real
 * implementation will hit the local FastAPI backend with the same interface.
 */

const id = () => Math.random().toString(36).slice(2, 10);

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const SAMPLE_TRANSCRIPTS = [
  "what is my cpu usage right now",
  "save note: order the replacement keyboard on Friday",
  "summarise the meeting notes from yesterday",
  "open my project folder",
];

const SAMPLE_REPLIES = [
  "Sample reply: I would read that from the local backend once it is connected.",
  "Sample reply: in demo mode I cannot touch your machine, so nothing was changed.",
  "Sample reply: this response is placeholder text from the mock service adapter.",
];

let transcriptIndex = 0;
let replyIndex = 0;

export function createMockVyoraService(): VyoraService {
  let connected = false;

  let speechDownloaded = false;

  const notes: Note[] = [
    {
      id: id(),
      content: "Sample note: rename the export folder before sharing the build.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: id(),
      content:
        "Sample note: the assistant keeps the connection token in sessionStorage only, so it clears when the window closes.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    },
    {
      id: id(),
      content: "Sample note: check microphone levels before the standup.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
  ];

  const conversations: Conversation[] = [
    {
      id: id(),
      title: "Sample: workspace checkup",
      updatedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      messages: [],
    },
    {
      id: id(),
      title: "Sample: note taking",
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
      messages: [],
    },
  ];

  function status(): BackendStatus {
    return {
      connected,
      backendVersion: connected ? "demo-0.0.0" : null,
      aiModel: connected ? { name: "local-llm (demo)", loaded: true } : null,
      speechModel: connected
        ? { name: "whisper-small (demo)", downloaded: speechDownloaded, sizeMb: 466 }
        : null,
    };
  }

  return {
    isDemo: true,
    canDownloadSpeechModel: true,

    async createConversation() {
      const c: Conversation = { id: id(), title: "Sample: new conversation", updatedAt: new Date().toISOString(), messages: [] };
      conversations.unshift(c);
      return { ...c };
    },

    async getMessages(conversationId: string) {
      return [...(conversations.find((c) => c.id === conversationId)?.messages ?? [])];
    },

    async stop() {},

    async connect(token: string) {
      await wait(700);
      if (token.trim().length < 6) {
        throw new Error("That connection token was rejected. Tokens are at least 6 characters.");
      }
      connected = true;
      return status();
    },

    async disconnect() {
      await wait(200);
      connected = false;
      speechDownloaded = false;
    },

    async getStatus() {
      return status();
    },

    async getTelemetry(): Promise<SystemTelemetry> {
      // Sample numbers only — shown under a DEMO MODE label.
      const t = Date.now() / 6000;
      return {
        cpuPercent: Math.round(22 + 14 * Math.abs(Math.sin(t))),
        ramPercent: Math.round(48 + 9 * Math.abs(Math.cos(t / 1.7))),
        batteryPercent: 76,
        batteryCharging: true,
      };
    },

    async listMicrophones(): Promise<MicrophoneDevice[]> {
      return [
        { id: "default", label: "System default input (demo)" },
        { id: "usb-mic", label: "USB condenser mic (demo)" },
        { id: "headset", label: "Headset mic (demo)" },
      ];
    },

    async listConversations() {
      return conversations.map((c) => ({ ...c }));
    },

    async listNotes() {
      return notes.map((n) => ({ ...n }));
    },

    async loadSpeechModel() {
      await wait(1400);
      speechDownloaded = true;
    },

    async recordAndTranscribe({ seconds, signal }): Promise<TranscriptResult> {
      await wait(Math.min(seconds, 4) * 1000, signal);
      const transcript = SAMPLE_TRANSCRIPTS[transcriptIndex++ % SAMPLE_TRANSCRIPTS.length] ?? "hello vyora";
      await wait(600, signal);
      return { transcript, cancelled: false };
    },

    async sendMessage({ text, signal, onDelta }): Promise<AssistantReply> {
      await wait(900, signal);
      const match = /^save note:\s*(.+)$/i.exec(text.trim());
      let result: AssistantReply;
      if (match) {
        const note: Note = {
          id: id(),
          content: (match[1] ?? "").trim(),
          createdAt: new Date().toISOString(),
        };
        notes.unshift(note);
        result = {
          reply: `Saved that note in demo mode. It lives in this browser session only until the backend is connected.`,
          savedNote: note,
        };
      } else {
        result = {
          reply: SAMPLE_REPLIES[replyIndex++ % SAMPLE_REPLIES.length] ?? "Sample reply.",
        };
      }
      if (onDelta) {
        const words = result.reply.split(" ");
        let streamed = "";
        for (const word of words) {
          await wait(55, signal);
          streamed += `${streamed ? " " : ""}${word}`;
          onDelta(streamed);
        }
      }
      return result;
    },

    async speak({ text, signal }) {
      // Real speech output is produced by Python. Demo mode just waits.
      await wait(Math.min(4000, 400 + text.length * 25), signal);
    },
  };
}
