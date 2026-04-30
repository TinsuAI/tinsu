When creating any story involving React components, UI styling, or visual elements, the story will include that bold note:

  🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.
- run (npm run rebuild:electron) after each db changes
- whenever update schema, update  migration in db/index.ts
- When PM agent run correct course session Update sprint-status.yaml to reflect approved epic changes
- when doing codebase exploring, or any sub agents, use model Haiku with very detailed instructions so they can do great job
- we ported to src-tauri Tauri app
- Android dev build uses Tailscale: TAURI_DEV_HOST is set in .env (gitignored), loaded by android:dev script via `--host $TAURI_DEV_HOST`
- Mobile UI lives in `src/mobile/`. Do not add `useIsMobile()` branches to desktop components — mobile and desktop are separate trees rendered conditionally at `App.tsx` (Epic 3.5, sprint-change-proposal-2026-04-30.md). Reuse Rust backend, Zustand domain stores, rspc hooks, Calm Command tokens.