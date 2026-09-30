# Verification record

Prepared on 25 September 2026 in a Linux execution environment, using Python 3.12 and Node.js 24. This record distinguishes source verification from testing on the target Windows laptop.

## Passed

- `python -m pytest -q`: **13 passed**, no warnings in the final run.
- `python -m compileall -q app setup_local.py prepare_voice.py`: Python sources compiled successfully.
- `npm run build`: TypeScript checking and Vite production build completed successfully.
- Direct integration: the real TypeScript `api.ts` client called a running FastAPI service over HTTP, which called a mock Ollama HTTP server. Verified successful streaming, real SQLite chat persistence, note creation, allowed-origin CORS preflight, Stop cancellation, no cancelled chat persistence, and busy-state cleanup.

The model protocol fixture deliberately returned test text. It does not demonstrate real Qwen reasoning quality, hardware speed, or real Ollama model availability.

## Backend behaviours covered by the included tests

1. Missing and incorrect tokens cannot read private data.
2. Untrusted browser origins cannot mutate the database.
3. A note command persists the note and completed exchange.
4. Notes survive application recreation.
5. Blank chat text is rejected without history writes.
6. A missing conversation is rejected.
7. Missing voice weights produce a useful setup instruction.
8. An unknown application command does not execute or reach the model.
9. Unicode, quotes, and SQL-like note text are preserved safely.
10. Out-of-range volume is rejected before hardware access.
11. Model stream text is assembled and saved in order.
12. Failed streams do not save partial chat and release the busy state.
13. Stop cancels active generation, rejects concurrent chat, and allows a later request.

## Not verified here

- Real Windows microphone capture, SAPI voices, pycaw volume, or application launching.
- Real Qwen3 inference speed and memory use on the Ryzen 7 7730U.
- Offline operation after model downloads on the user's laptop.
- Visual browser rendering: the browser download failed in this environment, so a screenshot/browser interaction test was not completed. Responsive CSS and accessibility controls are included, but should be checked with the viewport checklist in `LOVABLE_PROMPTS.md`.
- Generated Lovable output, which is a separate project and may need adapter integration fixes.
- Windows `.cmd` launcher execution.

Do the manual checks in README step 11 before enabling daily use. This is a first-version local assistant, not a packaged production release.
