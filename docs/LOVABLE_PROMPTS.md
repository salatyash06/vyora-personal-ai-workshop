# Lovable prompts for VYORA

Use these in order. Lovable is the design tool; the assistant will run locally after Git sync. Never paste your actual local token into Lovable. Only the user running the app enters that token on the connection screen.

## Prompt 1 — frontend design

Copy the following:

```text
Build a polished desktop-first frontend for VYORA (pronounced Vee-or-ah), a personal Windows AI assistant. Tagline: Your voice. Your workspace. Your assistant.

Use React, TypeScript, Tailwind CSS, and small reusable components. This is a frontend project for a separate local Python FastAPI backend and SQLite database. Do not add Lovable Cloud, Supabase, hosted authentication, hosted AI, paid APIs, or an external database. Do not embed API keys or connection tokens.

Visual direction: refined futuristic command centre, deep charcoal/navy background, muted teal/cyan accents, restrained violet, readable typography, generous spacing, subtle borders. The interface must feel useful and calm. Use a lightweight CSS/SVG assistant orb, not a heavy 3D scene or constant particles. Use locally bundled assets/fonts or system fonts so the exported frontend can work offline.

Layout:
- Left sidebar: VYORA wordmark, New conversation button, Assistant, Notes, Settings, recent conversations, real backend connection indicator.
- Main Assistant screen: compact animated orb, clear status label, chat messages, suggested command chips, multiline input, Record button, Stop button, Send button.
- Right panel: CPU, RAM, battery, backend status, AI model status, downloaded speech-model status.
- Notes: readable note cards with content and dates; explain that notes are saved through 'save note: text' in chat.
- Settings: spoken-reply toggle, microphone selector, recording length 4/6/10/15 seconds, model information, disconnect button.
- Initial connection screen: password-style field for a locally generated connection token. Store it only in sessionStorage after successful validation.

Supported states: disconnected, ready, loading speech model, listening, transcribing, thinking, speaking, stopped, error. Never display fabricated live telemetry or claim an action succeeded without a backend result. Put all sample data behind an explicit DEMO MODE label and a mock service adapter that can be replaced later.

The first version records a short clip, fills the text input with its transcript, and waits for the user to press Send. Do not use browser SpeechRecognition or cloud text-to-speech. Python owns audio capture and speech output.

Use accessible keyboard navigation, visible focus rings, appropriate labels, readable contrast, responsive layouts at 390px/768px/1440px, and prefers-reduced-motion. Render chat as escaped text; do not inject raw HTML. Every visible button must have a working demo action or be clearly disabled with an explanation.

Create reusable components and keep all backend calls in a single typed service module. The API will be supplied next. Do not add reminder, automation, upload, or wake-word buttons before those backend capabilities exist.
```

## Prompt 2 — refine the interface

```text
Refine the VYORA frontend. Check the complete flow from connection to new conversation, streaming reply, notes, settings, and disconnect. Make the chat composer stay easy to reach, keep the last message visible during streaming, and prevent horizontal overflow on mobile. Make the orb subtle and leave enough space for readable chat. Add genuine empty/loading/error/disconnected states. Prevent duplicate sends, disable conversation switching during a request, and preserve typed text while navigating tabs. Ensure Stop is easy to find. Keep demo telemetry clearly marked as simulated. Retain the existing component and service separation; no cloud dependencies.
```

## Prompt 3 — integrate the local backend

Attach/paste `docs/API.md` and the supplied `frontend/src/api.ts`, then copy this:

```text
Connect VYORA to my existing local FastAPI backend using the attached exact API contract and TypeScript client. The base address is http://127.0.0.1:8000. Do not invent routes or response fields. Do not call Ollama or SQLite from the browser.

Replace the mock service in local mode. Keep the connection form, validate the user-entered token with GET /api/status, then store it in sessionStorage and send Authorization: Bearer <token> for /api requests. Never hardcode the token, add it to a URL, or put it in VITE_* build variables.

Load GET /api/conversations. Create one with POST /api/conversations if empty. Load its messages. Use the supplied streamChat async generator for POST /api/chat. This is NDJSON over fetch, not EventSource and not WebSocket. Handle state, token, done, error, and cancelled events. Do not call response.json() on the chat stream. Refresh conversation titles and notes after completion.

Record uses POST /api/listen with seconds and optional device ID; show actual backend voice_stage while pending, then place returned text in the input for review. Settings loads devices from GET /api/audio/devices. Spoken replies call POST /api/speak only after a successful completed reply, when enabled. Stop first calls POST /api/stop, then aborts the frontend chat fetch. Do not auto-speak cancelled replies.

Poll GET /api/status and GET /api/system every 2–3 seconds without overlapping requests. Mark disconnected on request failure. Display errors honestly. Keep history and Notes backed by real responses. All commands must be submitted through chat; no browser-side shell execution or fabricated success messages.

Run real integration only in the locally exported frontend. Keep the hosted preview in clearly labelled demo mode if it cannot reach the local service. The backend permits localhost and 127.0.0.1 on ports 5173 and 8080; document the actual local port used by this frontend. Do not loosen backend CORS to wildcard origins.
```

## Manual visual acceptance

- 1440px: side navigation, main chat and system panel fit without overlap.
- 390px: composer, Record, Stop, and Send remain usable; no sideways scrolling.
- Long messages, long notes and errors wrap.
- Reduced-motion setting removes orb animation.
- Keyboard alone can connect, navigate, type, send and stop.
- Disconnected state never shows simulated information as live.

Lovable code generation can vary. Treat the included working frontend and API contract as your reference when reviewing generated integration code.
