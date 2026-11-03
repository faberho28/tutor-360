# Tutor AI 360

> **Any laptop becomes a technical training lab.**
> Point its camera at a real circuit. SAM 3.1 segments every part. Muse Spark 1.3 names and judges each one, then writes a guided procedure for your level. A tracking engine keeps the masks on the parts while you work, and the guide is rewritten from your answers, from what you say out loud and from what appears in the scene. Ask by voice and the steps update live.

**Hackathon:** Meta Global AI Developer Hackathon 2026 — Build for Your World + Push the Frontier
**Track:** Indie Developer | **Models:** SAM 3.1 + Muse Spark 1.3 + Muse Voice Transcribe (via Meta Model API)
**Live demo:** <https://tutor-ia.hypot.app/>
**Flow:** Scan → Select a part → Follow the guide on the image → Answer by tapping or by voice → Final check → PDF report

Monorepo with pnpm. The app lives in `apps/web` and uses Next.js 16 (App Router), React 19, strict TypeScript and Tailwind CSS v4.

## Why it exists

In technical training institutes, a first-year apprentice practices on a real board, but no instructor can watch 20 benches at once. The apprentice removes a RAM module and does not know whether it was done right until something breaks.

Tutor AI 360 looks at the board with them: it names and judges each part, writes the next step for their level and rewrites it from what they report, so they get feedback while they work and not after the damage.

## Try it

1. Open <https://tutor-ia.hypot.app/> in a browser with a camera (Chrome recommended).
2. **Use your own Meta Model API key** (recommended for testing): click the **key icon** in the top bar ("Llave de la IA"), paste your key and save. The key lives only in the current tab (`sessionStorage`), is sent to the server in the `x-model-api-key` header for each request and is never logged or stored; closing the tab erases it. Without a key of your own the app uses the server's, if one is configured.
3. In the **Laboratorio** choose what to scan (Computador, Celular, Teclado or a custom case) and the reader's level.
4. In **Scan** allow the camera and press the automatic analysis button. Select a part to see its diagnosis and follow the guide that appears on the image.

## Quick start (run it yourself)

1. **API key.** Copy `apps/web/.env.example` to `apps/web/.env` and set your `MODEL_API_KEY`. If you prefer not to, paste it later with the key icon in the top bar.
2. **Run it**, with or without Docker:
   - With Docker: `docker compose up --build`.
   - Without Docker (Node 24 and pnpm 12): `pnpm install` and `pnpm dev`.
3. **Open** `http://localhost:3000` (the camera only works on `localhost` or over HTTPS).
4. **Use it:** in the Laboratorio choose what to scan and your level, allow the camera in Scan and press the automatic analysis button; select a part to see its diagnosis and follow the guide on the image.

If port 3000 is taken, use `WEB_PORT=3210 docker compose up --build` or `pnpm --filter web exec next dev -p 3210`.

## What it does

- **Open component detection.** There is no fixed list of parts: the AI plans what to look for from the chosen case and marks each part on the video with its mask, name and status (`ok`, `warning` or `anomaly`).
- **Per-part diagnosis.** When you select a part, the app explains what it is, what it sees and what to do, with the reason for each step. The diagnosis is requested when the part is selected.
- **Step-by-step guide.** A test-and-repair procedure written for the reader's level (junior, middle or senior apprentice, or technician), chosen in the Laboratorio. Each step is shown on the image, next to the blinking part, and is answered with what actually happened; the guide is rewritten from those answers and from what is new in the scene. It can also be followed by voice.
- **Automatic mode.** Detects changes in the scene (camera moved, part added or removed) and analyzes again only when needed. In between, a tracking engine keeps the masks on the objects on screen.
- **Captures.** Saves up to 20 captures with the visible masks and the reviewed statuses.
- **PDF report.** Builds an A4 report in the browser with the captures and the diagnoses.
- **Your own API key.** The key icon in the top bar lets you use your own Meta Model API key; it is kept only in the current tab (`sessionStorage`).

## How it works

1. **Planning.** Muse Spark looks at the image and, together with the case context, proposes which kinds of parts to look for, with three phrasings of each (SAM is very sensitive to how an object is named).
2. **Segmentation.** SAM 3.1 segments each phrasing separately, one per call and in parallel, and the best phrasing of each part is kept. Before they compete, specks, giant masks, masks that contain others and duplicates are discarded.
3. **Review.** Muse Spark looks at each kind of part, gives it its final name in Spanish and rates it (`ok`, `warning`, `anomaly`) with the reason.
4. **Diagnosis.** For a specific part a crop with context is sent; if the crop does not support the reported fault, the part drops from `anomaly` to `warning`.
5. **Tracking.** Between analyses, a tracking engine marks points on each object from the masks SAM calculated and follows them with the scene, so the masks stay in place; when an object cannot be followed, SAM and Muse Spark are asked again.

Coordinates in the app state are normalized (0 to 1); the overlay applies the video's `object-cover` crop.

## Model calibration

Detection quality depends on how the use of SAM and Muse Spark is calibrated. Every choice came from real runs against the API:

- **One object class per SAM request.** With a list of objects or a generic phrase it returns an empty result, with no error. That is why Spark plans the parts and each phrasing is requested separately.
- **Three phrasings per part.** A part that gave zero masks with one wording shows up with another. The phrasing with the most confident masks wins.
- **Confidence threshold.** Correct masks on a board usually score between 0.50 and 0.85, so a high fixed cut-off hides most of them. Masks are kept from 0.50 and the configurable threshold (`SEGMENT_SCORE_THRESHOLD`) only decides which masks count as "sure" when choosing between phrasings.
- **Noise filter before choosing.** Masks under 0.04 % of the frame, those over 60 %, those over 25 % that contain three or more other masks (the board under its parts, the keyboard under its keys) are discarded and, of two masks that overlap (IoU ≥ 0.5), the less confident one is dropped.
- **Spark at `minimal` effort and temperature 0.2.** Raising the effort did not improve the results and did add latency; the low temperature steadies the structure of the answers. Output uses strict `json_schema`.
- **Analysis separate from the tutor.** The planner and the reviewer have their own prompts and know nothing about the guide: the two only meet through the masks (the numbered picture and their statuses).
- **One review per kind of part**, on a copy of the frame where only that part is outlined, instead of one call per mask.
- **Known limits.** The same photo can vary between runs; choosing the phrasing with the most confident masks can reward one that is too general and catches look-alike objects; a group that mixes different objects is named by its most common content; SAM does not read printed text. More clean and damaged boards need to be measured to know the real false-positive rate.

## Requirements

- Node.js 24 (LTS), pinned in `.nvmrc`.
- pnpm 12, managed with Corepack (`corepack enable pnpm`). The exact version is in the `packageManager` field of `package.json`.
- A Meta Model API key (on the server or from the key icon in the top bar).
- A browser with a camera. The camera requires HTTPS or `localhost`.

## Installation

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`. If the port is taken: `pnpm --filter web exec next dev -p 3210`.

### Environment variables

All are server-only (none uses the `NEXT_PUBLIC_` prefix) and have a default, except the key. `lib/env.ts` validates them with Zod and fails with a message naming the invalid variable.

| Variable                   | Use                                                                                  | Default                     |
| -------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| `MODEL_API_KEY`            | Meta Model API key (optional if each user pastes their own)                          | —                           |
| `MODEL_API_BASE_URL`       | API base URL                                                                         | `https://api.meta.ai/v1`    |
| `SEGMENTATION_MODEL`       | Segmentation model                                                                   | `sam-3.1`                   |
| `SCENE_MODEL`              | Model that plans and reviews the parts, and writes the guide                         | `muse-spark-1.3`            |
| `TRANSCRIPTION_MODEL`      | Model that turns voice into text                                                     | `muse-voice-transcribe-1.0` |
| `DIAGNOSIS_MODEL`          | Model for each part's diagnosis                                                      | `muse-spark-1.3`            |
| `DIAGNOSIS_FALLBACK_MODEL` | Diagnosis fallback on quota, timeout, network or server errors                       | `muse-spark-1.2`            |
| `SEGMENT_SCORE_THRESHOLD`  | Confidence (0 to 1) from which a mask counts as sure when choosing between phrasings | `0.85`                      |

The key the user pastes with the key icon travels in the `x-model-api-key` header and takes priority over `MODEL_API_KEY`. It is never logged or stored on the server.

## Usage

1. On the home screen go to the **Laboratorio** and choose what to scan: Computador, Celular, Teclado or a custom case (with your own context), and the reader's level.
2. In **Scan** allow the camera. The capture button (or the space bar) analyzes the current frame; in automatic mode the app analyzes by itself when it detects changes.
3. Hover a mask to see its name and status. Selecting a part (on the image or in the list) opens the side panel with its diagnosis, and it closes when the part is deselected.
4. Build the PDF report from the control bar.

### Shortcuts in Scan

| Key     | Action                                |
| ------- | ------------------------------------- |
| `Space` | Capture and analyze the current frame |
| `A`     | Turn automatic mode on or off         |
| `R`     | Generate the report                   |
| `G`     | Show or hide the change grid          |
| `?`     | Show the shortcuts help               |

### Other actions

- **Double click** on a mask hides it (it does not delete it). With the cursor over it you see its outline and name; a click shows it again. The eye button in the list does the same.
- **Reset context** (button in the control bar) discards the plan, the reviews and the tracking, and keeps the case and the camera. It asks for confirmation if there are captures.
- Leaving `/scan` discards the whole session.

## Routes

| Route                  | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `/`                    | Welcome screen                                               |
| `/laboratorio`         | Choose the case to scan                                      |
| `/scan?caso=<id>`      | Scan screen (without `caso` it redirects to the Laboratorio) |
| `/design`              | Style guide; development only (404 in production)            |
| `GET /api/health`      | Service status                                               |
| `POST /api/analyze`    | Plans the parts and segments them per phrasing               |
| `POST /api/review`     | Names and rates a kind of part                               |
| `POST /api/diagnose`   | Diagnosis of a part from a crop                              |
| `POST /api/guide`      | Step-by-step procedure and its revision                      |
| `POST /api/verify`     | Compares the final scene with its initial description        |
| `POST /api/voice`      | Interprets what the person following the guide says          |
| `POST /api/transcribe` | Turns a voice fragment into text                             |

## Scripts

| Script                              | Description                           |
| ----------------------------------- | ------------------------------------- |
| `pnpm dev`                          | `apps/web` development server         |
| `pnpm build`                        | Production build                      |
| `pnpm lint`                         | ESLint                                |
| `pnpm typecheck`                    | `tsc --noEmit`                        |
| `pnpm format` / `pnpm format:check` | Prettier writes / checks              |
| `pnpm check`                        | `format:check` + `lint` + `typecheck` |

Run `pnpm check` before every commit.

## Structure

```
apps/web/
  app/               Routes, layout, global styles and API routes
  components/scan/   Scan screen: stage, overlay, control bar, panel, list and detail
  components/lab/    Laboratorio: case cards and the custom case dialog
  components/ui/     shadcn/ui components
  hooks/             Media queries, fullscreen, shortcuts and timers
  lib/session/       Session state (Zustand) and its provider
  lib/overlay/       Geometry, mask and label drawing, capture composition
  lib/camera/        Camera access, device list and frame capture
  lib/vision/        Change detection on the video
  lib/tracking/      Mask tracking
  lib/models/        Meta Model API client (server only)
  lib/analysis/      Planning, segmentation, mask cleaning and analysis scheduling
  lib/diagnosis/     Crops and the diagnosis client
  lib/report/        PDF report (jspdf, loaded on demand)
  lib/lab/           Laboratorio cases
  lib/services/      Services the UI uses (diagnosis, report, analysis)
samples/             Sample photos
```

## Design system

- Tailwind CSS v4, shadcn/ui (Radix base, `vega` preset), `lucide-react` and Inter (`next/font`).
- The color tokens, radii and light/dark theme live in `apps/web/app/globals.css`. The overlay colors by part status are in `apps/web/lib/overlay-theme.ts` and `apps/web/lib/component-status.ts`.
- The shadcn components are in `apps/web/components/ui/`. Add them with `pnpm dlx shadcn@latest add <component>` from `apps/web`. If `select`, `dropdown-menu`, `tooltip` or `progress` is added again, their local changes must be reapplied (see `components/ui/portal-container.tsx`).
- The theme follows the system by default and can be forced with the theme selector; the choice is saved in `localStorage`.
- With `pnpm dev`, the visual guide is at `http://localhost:3000/design`.
- Text color pairs meet AA contrast (4.5:1) in light and dark; when a token changes, measure it again.

## Limitations

- Detection quality depends on the image: good light and the part in view. The same frame can give slightly different results between analyses.
- On a board with many components the list can reach dozens of masks.
- Text printed on the parts is not read for segmentation.
- Each analysis spends calls to the model API; automatic mode only analyzes when it detects a change.

## Conventions

- Commits follow Conventional Commits.
- Code, identifiers and comments in English; interface text in Spanish (es-CO).
- Only `README.md` is versioned among the Markdown files; the rest of the documentation is local.
