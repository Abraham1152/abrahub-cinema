# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ABRAhub Cinema — AI-powered image/video generation studio. React SPA deployed to GitHub Pages with Supabase backend (auth, database, realtime, edge functions). Users bring their own Gemini API key (BYOK model) stored in `user_api_keys` table.

## Commands

```bash
npm run dev          # Start Vite dev server on port 8080
npm run build        # Production build to dist/
npm run lint         # ESLint check
npm run electron:dev # Run Electron desktop app (dev)
npm run dist         # Build + package Electron portable (Windows)
```

No `npm test` script is configured. Testing uses vitest (`npx vitest` or `npx vitest run`).

### Supabase Functions

```bash
npx supabase functions deploy <function-name>   # Deploy a single edge function
npx supabase functions serve                     # Local development
```

Functions live in `supabase/functions/` and run on Deno.

## Architecture

### Frontend Stack
- **React 18 + TypeScript + Vite** (SWC transpiler)
- **HashRouter** — required for GitHub Pages SPA routing
- **TailwindCSS + shadcn/ui** (Radix primitives) — dark theme, class-based
- **TanStack React Query** for server state
- **Path alias:** `@` → `src/`

### Routes (`src/App.tsx`)
- `/` — Main studio (image generation gallery)
- `/storyboard` — AI Director + canvas scene editor
- `/auth` — Authentication
- `/admin` — Preset management
- `/pricing`, `/privacy` — Static pages

### Key Source Files
- `src/pages/Index.tsx` — Studio page: gallery Map state, realtime subscriptions, generation controls
- `src/components/studio/GalleryGrid.tsx` — Gallery grid with optimistic UI (~2200 lines)
- `src/hooks/useStoryboard.ts` — Storyboard CRUD, `createScenesFromStructure()`
- `src/hooks/useAuth.ts` — Supabase auth + entitlement claiming
- `src/hooks/useGenerationQueue.ts` — Queue polling
- `src/components/storyboard/AIDirectorModal.tsx` — Campaign structure input (4 Select dropdowns)
- `src/components/storyboard/AIDirectorPreview.tsx` — Horizontal film strip preview
- `src/components/storyboard/SceneBlock.tsx` — Individual scene editor
- `src/integrations/supabase/client.ts` — Supabase JS client init
- `src/lib/api-utils.ts` — `fetchWithRetry()`, error handling (3 retries, exponential backoff)
- `src/config/cinema-equipment.ts` — Camera, lens, aperture, focal length option data

### Backend (Supabase Edge Functions)
- `process-generation-queue/` — Main image processor: dequeues items, calls Gemini, saves to storage
- `storyboard-generate-structure/` — AI Director: generates 5-scene campaign structure with video prompts
- `storyboard-generate-image/` — Scene image generation with style data
- `studio-generate-image/`, `studio-v2-generate/` — Studio image generation
- `validate-api-key/` — Validates user's Gemini API key
- `split-story6-grid/` — Split grid upscale processing
- `create-checkout/`, `stripe-webhook/`, `kiwify-webhook/` — Payment integrations

## Critical Patterns

### Gallery State (Map-based deduplication)
The gallery uses `Map<string, GalleryItem>` with queue IDs as temporary keys, replaced by image IDs on completion. **Always use a single atomic `setGalleryMap()` call** — never read-then-write in two separate calls. `optimisticQueueIdsRef` and `queueToImageMapRef` track pending generations.

### Gemini API — Base64 Required
Gemini rejects public image URLs. **Always convert URLs to base64** using `fetchImageAsBase64()` before sending to the API.

### Realtime Subscriptions
Gallery and storyboard use Supabase realtime. Realtime callbacks should only **update existing items** — never create new optimistic items from realtime events (causes duplicates).

### Split Grid
Uses `is_story6` flag, `reference_type: 'split_upscale'`, and `reference_prompt_injection: 'panel_number:N'` to track grid panels.

### Storyboard Style Data
`style_data` is a JSON column on scenes storing per-scene metadata: `video_prompt` (50-80 words English), `scene_emotion`, camera/lens choices. Video prompts are sequence-aware for campaign continuity.

## Language Convention

- **UI text, toast messages, labels:** Portuguese (Brazilian)
- **AI-generated prompts (image + video):** English

## Deployment

- **Frontend:** `git push origin main` → GitHub Actions auto-builds to GitHub Pages
- **Backend:** `npx supabase functions deploy <function-name>`
- Both should be deployed together when changes span frontend + backend

## Commit Convention

Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.

## Behavioral Rules

### NEVER
- Implement without showing options first (always 1, 2, 3 format)
- Delete/remove content without asking first
- Delete anything created in the last 7 days without explicit approval
- Change something that was already working
- Pretend work is done when it isn't
- Process a batch without validating one item first
- Add features that weren't requested
- Use mock data when real data exists in the database
- Explain/justify when receiving criticism — just fix
- Trust AI/subagent output without verification
- Create from scratch when something similar exists in `squads/`

### ALWAYS
- Present options in "1. X, 2. Y, 3. Z" format before implementing
- Use `AskUserQuestion` tool for clarifications
- Check `squads/` and existing components before creating new ones
- Read the complete schema before proposing database changes
- Investigate root cause when an error persists
- Commit before moving to the next task
- Create a session handoff in `docs/sessions/YYYY-MM/` at the end of each session
