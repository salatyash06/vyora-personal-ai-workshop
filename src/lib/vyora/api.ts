// Copy this adapter into a Lovable React project to reuse the backend contract.
export const BASE = 'http://127.0.0.1:8000';
export const TOKEN_KEY = 'vyora-local-token';

export interface Message { id: number; role: 'user' | 'assistant'; content: string; }
export interface Conversation { id: number; title: string; created_at: string; }
export interface Note { id: number; content: string; created_at: string; }
export interface Status {
  model: string; reachable: boolean; model_ready: boolean; speech_model_ready: boolean;
  busy: boolean; voice_busy: boolean; voice_stage: string; speaking: boolean; speech_error: string;
}
export interface SystemInfo {
  cpu_percent: number; memory_percent: number; memory_used_gb: number; memory_total_gb: number;
  battery_percent: number | null; plugged_in: boolean | null;
}
export type StreamEvent =
  | { type: 'state'; value: string }
  | { type: 'token'; text: string }
  | { type: 'done'; reply: string; source: string }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };

async function check(response: Response) {
  if (response.ok) return;
  const data = await response.json().catch(() => ({}));
  const detail = data.detail;
  throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail)
    ? detail.map((d: {msg: string}) => d.msg).join('; ') : `Request failed (${response.status}).`);
}

function headers(token?: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token ?? sessionStorage.getItem(TOKEN_KEY) ?? ''}`,
  };
}

export const UNREACHABLE =
  'Could not reach the VYORA assistant on this computer. Start the local assistant service, then try again.';

/** Turns low-level network failures into a message a person can act on. */
export function friendlyNetworkError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return error;
    if (error.name === 'TimeoutError' || error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      return new Error(UNREACHABLE);
    }
    return error;
  }
  return new Error(UNREACHABLE);
}

export async function api<T>(path: string, body?: unknown, options?: {token?: string; timeout?: number}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: headers(options?.token),
      body: body === undefined ? null : JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeout ?? 10000),
    });
  } catch (error) {
    throw friendlyNetworkError(error);
  }
  await check(response);
  return response.json() as Promise<T>;
}

export async function* streamChat(conversationId: number, text: string, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/chat`, {
      method: 'POST', headers: headers(), signal,
      body: JSON.stringify({conversation_id: conversationId, text}),
    });
  } catch (error) {
    throw friendlyNetworkError(error);
  }
  await check(response);
  if (!response.body) throw new Error('Streaming is not supported by this browser.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const {value, done} = await reader.read();
      buffer += decoder.decode(value, {stream: !done});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) yield JSON.parse(line) as StreamEvent;
      if (done) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer) as StreamEvent;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
