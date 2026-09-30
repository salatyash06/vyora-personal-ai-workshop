# VYORA local API contract

Base URL: `http://127.0.0.1:8000`. Run one backend process.

All `/api/*` requests require:

```http
Authorization: Bearer <value-from-backend-.env>
Content-Type: application/json
```

The token is entered locally by the user, not embedded in frontend source. `/health` is intentionally public and contains no personal data. Supported browser origins are exact entries in `FRONTEND_ORIGINS`.

| Method | Path | Request / response |
|---|---|---|
| GET | `/health` | `{status:"ok",name:"VYORA"}` |
| GET | `/api/status` | Model and voice readiness; see example below |
| GET | `/api/system` | CPU percent, RAM usage, battery |
| GET | `/api/conversations` | Up to 200 conversations, newest first |
| POST | `/api/conversations` | Empty body or `{}` → new conversation object |
| GET | `/api/conversations/{id}/messages` | Most recent 200 messages, chronological order |
| POST | `/api/chat` | `{conversation_id:number,text:string}` → NDJSON stream |
| GET | `/api/notes` | Up to 200 notes, newest first |
| GET | `/api/audio/devices` | `[{id:number,name:string},...]` |
| POST | `/api/listen` | `{seconds:2..15,device:number\|null}` → `{text:string,cancelled:boolean}` |
| POST | `/api/speak` | `{text:string}` → `{started:true}` |
| POST | `/api/stop` | `{}` → `{requested:true}` |

`text` in chat is 1–3000 characters after validation; whitespace-only messages fail. Speech output accepts up to 4000 characters. The included frontend caps spoken replies accordingly.

## Shapes

```json
{
  "model": "qwen3:4b",
  "reachable": true,
  "model_ready": true,
  "speech_model_ready": true,
  "busy": false,
  "voice_busy": false,
  "voice_stage": "idle",
  "speaking": false,
  "speech_error": ""
}
```

`reachable` means Ollama answered; `model_ready` means the configured model is downloaded, not that it is currently warm in memory. `speech_model_ready` checks local model weights; the first transcription still loads the model and may expose hardware/package issues. `busy` covers chat or microphone work. `speaking` is separate.

```json
{"cpu_percent":12.5,"memory_percent":43.0,"memory_used_gb":6.6,"memory_total_gb":15.3,"battery_percent":80,"plugged_in":true}
```

Battery fields are `null` if unavailable. Actual values come from the machine running Python, not the browser's machine.

Conversation: `{id:number,title:string,created_at:string}`.

Message: `{id:number,conversation_id:number,role:"user"|"assistant",content:string,created_at:string}`.

Note: `{id:number,content:string,created_at:string}`.

Timestamps are UTC ISO strings; the UI formats them locally.

## Streaming

Example request:

```json
{"conversation_id":1,"text":"Explain an assembler briefly."}
```

Example response: `Content-Type: application/x-ndjson`.

```jsonl
{"type":"state","value":"thinking"}
{"type":"token","text":"An assembler "}
{"type":"token","text":"converts assembly language into machine code."}
{"type":"done","reply":"An assembler converts assembly language into machine code.","source":"local-ai"}
```

Commands use `source:"command"`. Append token events to the current assistant bubble. A network chunk can contain part of a JSON line or several lines; use the included parser rather than assuming one network chunk equals one event.

Other terminal events:

```jsonl
{"type":"error","message":"Ollama is not running. Open Ollama on your laptop and retry."}
{"type":"cancelled"}
```

Errors after streaming starts arrive as an `error` event, even though the initial HTTP status was 200. A premature stream close with no terminal event is an error. Successful exchanges are committed to SQLite before `done`; interrupted model replies are not saved. Notes/actions already performed cannot be rolled back with Stop.

## Errors and single-user operation

- 401: incorrect/missing token.
- 403: unapproved browser origin.
- 404: nonexistent conversation.
- 409: another chat/listen operation is running.
- 422: invalid input.
- 503: missing speech model, unavailable device, or speech startup error.

Most errors are `{detail:string}`; validation errors use `{detail:[...]}`. Render them as text. Do not put arbitrary error text into raw HTML.

The app is intentionally single-user, single-process, and localhost-only. Stop applies to the active operation on that backend, including operations started in another tab. It is not a multi-user hosted API.

## Minimal usage with the provided client

```typescript
import { api, streamChat, TOKEN_KEY, type Conversation } from './api';

// token comes from a user-entered password field, never from source code.
await api('/status', undefined, { token });
sessionStorage.setItem(TOKEN_KEY, token);
const conversation = await api<Conversation>('/conversations', {});
const controller = new AbortController();
for await (const event of streamChat(conversation.id, 'hello', controller.signal)) {
  if (event.type === 'token') console.log(event.text);
  if (event.type === 'error') throw new Error(event.message);
}
// For a Stop button: await api('/stop', {}); controller.abort();
```
