import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getDemoService, getVyoraService, TOKEN_STORAGE_KEY } from "./service";
import type {
  AssistantSettings,
  AssistantState,
  BackendStatus,
  ChatMessage,
  Conversation,
  Note,
  MicrophoneDevice,
  RecordingSeconds,
  SystemTelemetry,
  VyoraService,
} from "./types";

interface VyoraContextValue {
  isDemo: boolean;
  canDownloadSpeechModel: boolean;
  state: AssistantState;
  statusMessage: string;
  errorMessage: string | null;
  status: BackendStatus | null;
  telemetry: SystemTelemetry | null;
  microphones: MicrophoneDevice[];
  conversations: Conversation[];
  notes: Note[];
  messages: ChatMessage[];
  draft: string;
  settings: AssistantSettings;
  busy: boolean;
  connecting: boolean;
  setDraft: (value: string) => void;
  updateSettings: (patch: Partial<AssistantSettings>) => void;
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  loadSpeechModel: () => Promise<void>;
  record: () => Promise<void>;
  stop: () => Promise<void>;
  activeConversationId: string | null;
  send: (text?: string) => Promise<void>;
  newConversation: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
}

const VyoraContext = createContext<VyoraContextValue | null>(null);

const STATUS_LABELS: Record<AssistantState, string> = {
  disconnected: "Disconnected",
  ready: "Ready",
  "loading-model": "Loading speech model",
  listening: "Listening",
  transcribing: "Transcribing",
  thinking: "Thinking",
  speaking: "Speaking",
  stopped: "Stopped",
  error: "Error",
};

export function statusLabel(state: AssistantState) {
  return STATUS_LABELS[state];
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function VyoraProvider({ children }: { children: ReactNode }) {
  // Start in demo on the server and first client render (avoids hydration
  // mismatch), then switch to the real local adapter on localhost.
  const [service, setService] = useState<VyoraService>(() => getDemoService());
  useEffect(() => {
    setService(getVyoraService());
  }, []);

  const [state, setState] = useState<AssistantState>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AssistantSettings>({
    spokenReplies: true,
    microphoneId: null,
    recordingSeconds: 6,
  });

  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const connected = status?.connected ?? false;

  const markDisconnected = useCallback((message: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setStatus(null);
    setTelemetry(null);
    setState("disconnected");
    setErrorMessage(message);
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      setConversationId(id);
      setMessages(await service.getMessages(id));
    },
    [service],
  );

  const hydrateAfterConnect = useCallback(
    async (next: BackendStatus) => {
      setStatus(next);
      setState("ready");
      setErrorMessage(null);
      const [mics, convos, storedNotes] = await Promise.all([
        service.listMicrophones().catch(() => [] as MicrophoneDevice[]),
        service.listConversations(),
        service.listNotes(),
      ]);
      let list = convos;
      if (list.length === 0) list = [await service.createConversation()];
      setMicrophones(mics);
      setConversations(list);
      setNotes(storedNotes);
      setSettings((prev) => ({ ...prev, microphoneId: prev.microphoneId ?? mics[0]?.id ?? null }));
      const first = list[0];
      if (first) await openConversation(first.id);
    },
    [service, openConversation],
  );

  // Restore an existing session token (sessionStorage only).
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;
    let cancelled = false;
    service
      .connect(token)
      .then((next) => (cancelled ? undefined : hydrateAfterConnect(next)))
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not reach the local backend.");
      });
    return () => {
      cancelled = true;
    };
  }, [service, hydrateAfterConnect]);

  // Poll status + system every 2.5s, never overlapping.
  useEffect(() => {
    if (!connected) {
      setTelemetry(null);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const [nextStatus, nextTelemetry] = await Promise.all([service.getStatus(), service.getTelemetry()]);
        if (!active) return;
        setStatus(nextStatus);
        setTelemetry(nextTelemetry);
        if (!service.isDemo && stateRef.current === "speaking" && !nextStatus.speaking) setState("ready");
      } catch (error) {
        if (!active) return;
        markDisconnected(
          `Lost connection to the local backend: ${error instanceof Error ? error.message : "request failed"}`,
        );
        return;
      }
      if (active) timer = setTimeout(tick, 2500);
    };
    void tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [connected, service, markDisconnected]);

  const connect = useCallback(
    async (token: string) => {
      setConnecting(true);
      setErrorMessage(null);
      try {
        const next = await service.connect(token);
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
        await hydrateAfterConnect(next);
      } catch (error) {
        setStatus(null);
        setState("disconnected");
        setErrorMessage(error instanceof Error ? error.message : "Could not connect.");
        throw error;
      } finally {
        setConnecting(false);
      }
    },
    [service, hydrateAfterConnect],
  );

  const disconnect = useCallback(async () => {
    abortRef.current?.abort();
    await service.disconnect();
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setStatus(null);
    setState("disconnected");
    setErrorMessage(null);
    setMessages([]);
    setNotes([]);
    setConversations([]);
    setConversationId(null);
    setTelemetry(null);
    setDraft("");
  }, [service]);

  const loadSpeechModel = useCallback(async () => {
    setState("loading-model");
    setErrorMessage(null);
    try {
      await service.loadSpeechModel();
      setStatus(await service.getStatus());
      setState("ready");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "The speech model failed to load.");
    }
  }, [service]);

  const stop = useCallback(async () => {
    // Ask the backend first, then abort the browser request.
    try {
      await service.stop();
    } catch (error) {
      setErrorMessage(`Stop request failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => (prev === "ready" || prev === "disconnected" ? prev : "stopped"));
  }, [service]);

  const record = useCallback(async () => {
    if (busyRef.current) return;
    if (!status?.speechModel?.downloaded) {
      setState("error");
      setErrorMessage("The speech model is not available on the local backend yet.");
      return;
    }
    const controller = new AbortController();
    busyRef.current = true;
    abortRef.current = controller;
    setErrorMessage(null);
    setState("listening");
    try {
      const { transcript, cancelled } = await service.recordAndTranscribe({
        seconds: settings.recordingSeconds,
        microphoneId: settings.microphoneId,
        signal: controller.signal,
      });
      if (cancelled) {
        setState("stopped");
        return;
      }
      setDraft(transcript);
      setState("ready");
    } catch (error) {
      if (controller.signal.aborted || (error as DOMException)?.name === "AbortError") return;
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Recording failed.");
    } finally {
      busyRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [service, settings.recordingSeconds, settings.microphoneId, status]);

  const send = useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || !connected || !conversationId || busyRef.current) return;
      if (text.length > 3000) {
        setErrorMessage("Messages can be at most 3000 characters.");
        return;
      }
      busyRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      setErrorMessage(null);
      setDraft("");
      const userMessage: ChatMessage = { id: newId(), role: "user", text, createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, userMessage]);
      setState("thinking");
      const assistantId = newId();
      const upsert = (nextText: string) =>
        setMessages((prev) => {
          const reply = { id: assistantId, role: "assistant" as const, text: nextText, createdAt: new Date().toISOString() };
          return prev.some((m) => m.id === assistantId)
            ? prev.map((m) => (m.id === assistantId ? reply : m))
            : [...prev, reply];
        });
      try {
        const result = await service.sendMessage({
          conversationId,
          text,
          signal: controller.signal,
          onDelta: upsert,
          onState: (value) => {
            if (value === "thinking") setState("thinking");
          },
        });
        if (result.cancelled) {
          setState("stopped");
          return;
        }
        upsert(result.reply);
        if (result.savedNote) {
          const savedNote = result.savedNote;
          setNotes((prev) => [savedNote, ...prev]);
        }
        // Refresh titles and notes from the backend after completion.
        void Promise.all([service.listConversations(), service.listNotes()])
          .then(([convos, storedNotes]) => {
            setConversations(convos);
            setNotes(storedNotes);
          })
          .catch(() => undefined);
        if (settings.spokenReplies && result.reply.trim()) {
          setState("speaking");
          await service.speak({ text: result.reply, signal: controller.signal });
          if (service.isDemo) setState("ready");
        } else {
          setState("ready");
        }
      } catch (error) {
        if (controller.signal.aborted || (error as DOMException)?.name === "AbortError") {
          setState("stopped");
          return;
        }
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "The assistant did not reply.");
        setDraft((current) => current || text);
      } finally {
        busyRef.current = false;
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [draft, connected, service, conversationId, settings.spokenReplies],
  );

  const newConversation = useCallback(async () => {
    if (busyRef.current || !connected) return;
    busyRef.current = true;
    try {
      const created = await service.createConversation();
      setConversations((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setConversationId(created.id);
      setMessages([]);
      setDraft("");
      setErrorMessage(null);
      setState("ready");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not create a conversation.");
    } finally {
      busyRef.current = false;
    }
  }, [connected, service]);

  const selectConversation = useCallback(
    async (nextConversationId: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await openConversation(nextConversationId);
        setState(connected ? "ready" : "disconnected");
        setErrorMessage(null);
      } catch (error) {
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "Could not load that conversation.");
      } finally {
        busyRef.current = false;
      }
    },
    [connected, openConversation],
  );

  const updateSettings = useCallback((patch: Partial<AssistantSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<VyoraContextValue>(
    () => ({
      isDemo: service.isDemo,
      canDownloadSpeechModel: service.canDownloadSpeechModel,
      state,
      statusMessage:
        (state === "listening" || state === "transcribing") && status?.voiceStage && status.voiceStage !== "idle"
          ? `${statusLabel(state)} · ${status.voiceStage}`
          : statusLabel(state),
      activeConversationId: conversationId,
      errorMessage,
      status,
      telemetry,
      microphones,
      conversations,
      notes,
      messages,
      draft,
      settings,
      busy: state === "listening" || state === "transcribing" || state === "thinking" || state === "speaking",
      connecting,
      setDraft,
      updateSettings,
      connect,
      disconnect,
      loadSpeechModel,
      record,
      stop,
      send,
      newConversation,
      selectConversation,
    }),
    [
      service.isDemo,
      service.canDownloadSpeechModel,
      conversationId,
      state,
      errorMessage,
      status,
      telemetry,
      microphones,
      conversations,
      notes,
      messages,
      draft,
      settings,
      connecting,
      updateSettings,
      connect,
      disconnect,
      loadSpeechModel,
      record,
      stop,
      send,
      newConversation,
      selectConversation,
    ],
  );

  return <VyoraContext.Provider value={value}>{children}</VyoraContext.Provider>;
}

export function useVyora() {
  const context = useContext(VyoraContext);
  if (!context) throw new Error("useVyora must be used inside VyoraProvider");
  return context;
}

export type { RecordingSeconds };
