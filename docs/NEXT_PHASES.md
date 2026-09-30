# Build beyond the first working version

These are separate future milestones, not features claimed to be implemented in the starter.

## Phase A — confirm the foundation

Follow README steps 1–11. Record your actual model response delay, microphone transcription accuracy, memory use, and Stop behaviour. Fix those issues before adding background listening. Keep commands fast by continuing to route simple actions directly.

## Phase B — more Windows capabilities

Add one allowlisted function at a time in `backend/app/actions.py`: opening your known VS Code executable, changing brightness on a supported display, or controlling a particular media application. Use absolute executable paths and argument arrays with `shell=False`. Never pass model text to a shell. Prefer Windows APIs or pywinauto selectors to fragile screen coordinates. Test success and failure on each target application.

For destructive actions or sending messages, build a pending-action record with validated parameters and a confirmation control. Execution must require confirmation of that exact action; do not treat ordinary conversation as permission for future arbitrary actions.

## Phase C — wake word and automatic voice turns

Evaluate openWakeWord with a supplied supported phrase before training “Hey VYORA”. A custom name does not automatically come with a working wake-word model. Use one microphone pipeline, voice activity detection, time limits, false-trigger tests, and a visible mute control. Pause or echo-cancel input during speech output. Add an opt-in automatic-send mode only after transcription quality is acceptable.

## Phase D — reminders and routines

Create a `reminders` table containing text, an unambiguous UTC due time, the user's timezone, and delivered state. Add a scheduler that reloads pending reminders at startup, handles missed due times, and prevents duplicate delivery. Test restart behaviour. Windows notifications require a running background process. Build routines from known actions, with a visible ordered task list and per-step results.

## Phase E — document questions

Start with user-selected text/PDF files. Extract and chunk text, index it locally, and retrieve relevant passages before calling the model. Show source filenames and page references. Documents are data, not instructions to execute computer actions. Scanned PDFs require OCR; large local embedding/vision models will increase RAM and disk requirements.

## Phase F — desktop packaging

After local integration is stable, wrap the React build with Electron or another desktop shell. Package/start the Python service and terminate it cleanly on exit. Keep context isolation and sandboxing enabled, disable Node integration in the renderer, and expose narrow IPC functions only. Keep Ollama/model installation explicit and avoid silently shipping multi-gigabyte models. An installer, autostart, tray icon, and auto-update mechanism each need Windows tests.

## Phase G — natural-language action planning

Define typed action proposals such as `{action:"open_app",app_id:"calculator"}`. Validate against an allowlist, separate planning from execution, and show required confirmations. Make the executor report real results to the model. Test malformed JSON, unsupported apps, ambiguous requests, cancellation, and malicious instructions in documents. Do not let an LLM bypass the deterministic command executor.

The project becomes more capable through reliable integrations and verified results, not by adding more decorative dashboard buttons.
