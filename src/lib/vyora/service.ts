import { TOKEN_KEY } from "./api";
import { createLocalVyoraService } from "./local-service";
import { createMockVyoraService } from "./mock-service";
import type { VyoraService } from "./types";

/**
 * Single entry point for every backend call.
 *
 * Local mode (the frontend is served from localhost / 127.0.0.1, e.g. the
 * exported app on port 8080) talks to the real FastAPI backend at
 * http://127.0.0.1:8000. Anywhere else — including the hosted preview — the
 * clearly labelled DEMO MODE adapter is used, because a hosted page cannot
 * reach the user's local service.
 */
export function isLocalOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

let mock: VyoraService | null = null;
let local: VyoraService | null = null;

export function getDemoService(): VyoraService {
  mock ??= createMockVyoraService();
  return mock;
}

export function getVyoraService(): VyoraService {
  if (isLocalOrigin()) {
    local ??= createLocalVyoraService();
    return local;
  }
  return getDemoService();
}

export const TOKEN_STORAGE_KEY = TOKEN_KEY;
