<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Project rules

- VYORA is a frontend-only app for a separate local Python FastAPI backend: no Lovable Cloud, Supabase, hosted auth, hosted AI, or embedded keys.
- All backend calls go through the typed `VyoraService` interface in `src/lib/vyora/service.ts`, so the demo adapter can be swapped for the real local API in one place.
- Shared assistant state lives in `src/lib/vyora/store.tsx` (React context), because the connection gate, chat, notes, and settings screens all read the same session state.
- Sample data is served only by `mock-service.ts` and must always be labelled with `DemoBadge`, so no fabricated telemetry looks live.
- The connection token is stored in `sessionStorage` only, never localStorage or cookies.
- Audio capture and speech output belong to Python; never use browser SpeechRecognition or cloud TTS.

- Tests: `npm test` (vitest, store logic with a fake VyoraService) and `npm run test:e2e` (Playwright, backend mocked via page.route) — keeps regressions checkable without the real local service.
