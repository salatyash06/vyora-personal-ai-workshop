// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BackendStatus, ChatMessage, VyoraService } from "./types";

let fake: VyoraService & { calls: string[] };

vi.mock("./service", () => ({
  TOKEN_STORAGE_KEY: "vyora-local-token",
  getDemoService: () => fake,
  getVyoraService: () => fake,
}));

import { useVyora, VyoraProvider } from "./store";

const STATUS = {
  connected: true,
  backendVersion: null,
  aiModel: { name: "test", loaded: true },
  speechModel: { name: "speech", downloaded: true, sizeMb: null },
} as unknown as BackendStatus;

function makeFake() {
  const calls: string[] = [];
  const conversations = [
    { id: "c1", title: "First", updatedAt: new Date().toISOString() },
    { id: "c2", title: "Second", updatedAt: new Date().toISOString() },
  ];
  const service = {
    isDemo: false,
    canDownloadSpeechModel: false,
    calls,
    connect: vi.fn(async () => STATUS),
    disconnect: vi.fn(async () => void calls.push("disconnect")),
    getStatus: vi.fn(async () => STATUS),
    getTelemetry: vi.fn(async () => ({ cpuPercent: 1, ramPercent: 1, battery: null }) as never),
    listMicrophones: vi.fn(async () => []),
    listConversations: vi.fn(async () => conversations),
    listNotes: vi.fn(async () => []),
    createConversation: vi.fn(async () => conversations[0]),
    getMessages: vi.fn(async (id: string) => {
      calls.push(`getMessages:${id}`);
      return [] as ChatMessage[];
    }),
    loadSpeechModel: vi.fn(async () => undefined),
    recordAndTranscribe: vi.fn(async () => ({ transcript: "" })),
    speak: vi.fn(async () => void calls.push("speak")),
    stop: vi.fn(async () => void calls.push("stop")),
    // Streams one token, then waits until aborted.
    sendMessage: vi.fn(
      ({ signal, onDelta }: { signal?: AbortSignal; onDelta?: (t: string) => void }) =>
        new Promise((resolve, reject) => {
          onDelta?.("Partial");
          signal?.addEventListener("abort", () => {
            calls.push("abort");
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    ),
  };
  return service as unknown as VyoraService & { calls: string[] };
}

const wrapper = ({ children }: { children: ReactNode }) => <VyoraProvider>{children}</VyoraProvider>;

async function connected() {
  const hook = renderHook(() => useVyora(), { wrapper });
  await act(() => hook.result.current.connect("secret"));
  await waitFor(() => expect(hook.result.current.activeConversationId).toBe("c1"));
  return hook;
}

beforeEach(() => {
  fake = makeFake();
  sessionStorage.clear();
});
afterEach(() => vi.clearAllMocks());

describe("VYORA session", () => {
  it("stops a streamed reply: backend stop first, then abort, keeps partial text, no speech", async () => {
    const { result } = await connected();
    act(() => void result.current.send("hello"));
    await waitFor(() => expect(result.current.state).toBe("thinking"));
    await waitFor(() => expect(result.current.messages.at(-1)?.text).toBe("Partial"));

    await act(() => result.current.stop());

    expect(fake.calls.indexOf("stop")).toBeLessThan(fake.calls.indexOf("abort"));
    await waitFor(() => expect(result.current.state).toBe("stopped"));
    expect(result.current.busy).toBe(false);
    expect(fake.speak).not.toHaveBeenCalled();
  });

  it("blocks conversation switches and new conversations while a request is active", async () => {
    const { result } = await connected();
    act(() => void result.current.send("hello"));
    await waitFor(() => expect(result.current.busy).toBe(true));

    await act(() => result.current.selectConversation("c2"));
    await act(() => result.current.newConversation());
    expect(result.current.activeConversationId).toBe("c1");
    expect(fake.calls).not.toContain("getMessages:c2");

    await act(() => result.current.stop());
    await act(() => result.current.selectConversation("c2"));
    expect(result.current.activeConversationId).toBe("c2");
  });

  it("ignores a duplicate send while a reply is streaming", async () => {
    const { result } = await connected();
    act(() => void result.current.send("one"));
    await waitFor(() => expect(result.current.busy).toBe(true));
    await act(() => result.current.send("two"));
    expect(fake.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("disconnect clears the token and all session data", async () => {
    const { result } = await connected();
    expect(sessionStorage.getItem("vyora-local-token")).toBe("secret");
    act(() => result.current.setDraft("unsent"));

    await act(() => result.current.disconnect());

    expect(fake.disconnect).toHaveBeenCalled();
    expect(sessionStorage.getItem("vyora-local-token")).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(result.current.status).toBeNull();
    expect(result.current.state).toBe("disconnected");
    expect(result.current.conversations).toEqual([]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.draft).toBe("");
  });
});
