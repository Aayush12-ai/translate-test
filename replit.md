# WebRTC Video Call App

A real-time, browser-based video calling application built with WebRTC for peer-to-peer video/audio communication.

## Architecture

This is a **pnpm monorepo** with the following structure:

```text
/
|-- artifacts/
|   |-- api-server/      # Express + WebSocket signaling server (port 18080 by default)
|   `-- video-call/      # React frontend (port 5000)
|-- lib/
|   |-- api-spec/        # OpenAPI spec + Orval codegen config
|   |-- api-zod/         # Generated Zod schemas
|   |-- api-client-react/ # Generated React Query hooks
|   `-- db/              # Drizzle ORM schema + PostgreSQL client
|-- pnpm-workspace.yaml  # Monorepo workspace + catalog versions
|-- package.json         # Root package with shared scripts
|-- start.sh             # Dev startup script
`-- start-prod.sh        # Production startup script
```

## Technologies

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Shadcn UI (Radix UI), TanStack Query, Wouter
- **Backend**: Node.js, Express v5, WebSocket (ws), Pino logging, esbuild
- **Database**: PostgreSQL, Drizzle ORM (optional - falls back to in-memory if no DATABASE_URL)
- **API**: OpenAPI spec -> Orval-generated Zod schemas and React Query hooks
- **Real-time**: WebRTC with WebSocket signaling

## Running the App

The app uses a single workflow that starts both servers:

```bash
bash /home/runner/workspace/start.sh
```

- **Frontend** -> `http://0.0.0.0:5000` (Vite dev server, proxies `/api` and `/ws` to the API)
- **API server** -> `http://127.0.0.1:18080`

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (optional). If not set, rooms are stored in memory.
- `PORT` - Override for the API server port (default: 18080)

## Key Features

- Create and join video call rooms
- WebRTC peer-to-peer video/audio with STUN servers
- Screen sharing with host-approval flow
- Password-protected rooms
- Real-time WebSocket signaling
- **Live subtitles with translation** - browser Web Speech API (Google STT engine) + Azure AI Translator for translation, relayed via `/ws/transcribe` WebSocket to all room participants

## Subtitles / Translation Pipeline

```text
Browser mic -> Web Speech API (Google STT, free)
  -> Final transcript -> WebSocket /ws/transcribe
  -> Backend: Azure AI Translator
  -> Translated subtitle -> broadcast to all room peers
  -> Subtitle overlay rendered on call page
```

- Set `AZURE_TRANSLATOR_KEY` to enable translated output
- `AZURE_TRANSLATOR_ENDPOINT` defaults to `https://api.cognitive.microsofttranslator.com`
- Set `AZURE_TRANSLATOR_REGION` if your Azure Translator resource is regional or multi-service
- Optional: set `AZURE_TRANSLATOR_CATEGORY` to use a deployed Custom Translator model
- Legacy fallback: `LIBRETRANSLATE_URL` and `LIBRETRANSLATE_API_KEY` still work if Azure is not configured
- Speech recognition works in Chrome and Edge (Web Speech API)
- 15 supported languages: EN, ES, FR, DE, IT, PT, RU, ZH, JA, KO, AR, HI, NL, PL, TR

## Development Notes

- The pnpm catalog (versions) is defined in `pnpm-workspace.yaml`
- API types are generated from `lib/api-spec/openapi.yaml` using Orval
- Run `pnpm --filter @workspace/api-spec codegen` to regenerate types
- Run `pnpm --filter @workspace/db push` to push DB schema (requires `DATABASE_URL`)
- esbuild bundles the API server; the build output goes to `artifacts/api-server/dist/`

## Deployment

Configured as a **VM** deployment (always-running, needed for WebSocket connections):
- Build: compiles API server + builds frontend static files
- Run: starts API server + serves built frontend via vite preview
