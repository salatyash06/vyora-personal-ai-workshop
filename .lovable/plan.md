# Refine the VYORA assistant flow

## Goal
Make the existing desktop-first assistant feel dependable from connection through disconnect, while keeping the local Python service boundary and clearly labelled demo data.

## Changes

### Conversation and request safety
- Add an explicit active-conversation action so recent conversations can be opened, while disabling both switching and “New conversation” during recording, transcription, reply generation, or speech playback.
- Guard send and record actions at the shared state layer, not only in buttons, so rapid clicks or Enter presses cannot launch duplicate requests.
- Keep the current draft in shared state when moving between Assistant, Notes, and Settings; only clear it after a successful send or explicit disconnect.
- Make Stop prominent whenever work is active, abort the current operation, retain any completed/partial reply text, and restore a stable stopped state.

### Streaming chat experience
- Extend the typed `VyoraService` contract with streamed reply updates while keeping every backend call behind that interface.
- Update the demo adapter to emit visibly incremental sample text and preserve its DEMO MODE labeling.
- Show a genuine waiting/streaming message state, keep the latest content visible as tokens arrive, and avoid forcing the user to the bottom if they intentionally scroll up.
- Add clear retry-safe error presentation without automatically resending failed requests.

### Layout and responsive behavior
- Restructure the Assistant screen into a viewport-height workspace so the transcript scrolls independently and the composer remains reachable at the bottom.
- Reduce the orb’s visual footprint and motion while preserving all assistant states.
- Harden headers, messages, suggestion controls, status rows, and form controls against horizontal overflow at 390px, 768px, and 1440px.
- Keep enough transcript width and height for readable conversation; collapse the system panel sensibly below desktop widths.

### Complete visible states
- Distinguish connection restoration/loading, connected-empty, recording/transcribing/thinking/streaming/speaking, stopped, error, telemetry-loading/unavailable, notes-empty, and disconnected states.
- Label every demo metric as simulated at the metric area, not only through a general page badge.
- Disable settings and disconnect actions that would conflict with an active request, with concise visible explanations where needed.

### Verification
- Exercise connect → new conversation → send/stream → stop → notes → settings → navigation with draft preserved → disconnect.
- Verify no duplicate sends or conversation changes occur while busy.
- Check 390px, 768px, and 1440px layouts for clipping, overflow, composer access, and last-message visibility.
- Confirm route metadata, keyboard focus, reduced-motion behavior, build output, and browser console remain clean.

## Technical details
- Keep React context in `src/lib/vyora/store.tsx` as the shared session coordinator.
- Keep the mock and future FastAPI implementations interchangeable through `VyoraService`; no hosted services, cloud APIs, browser speech, or persistent token storage.
- Continue rendering messages strictly as escaped text.