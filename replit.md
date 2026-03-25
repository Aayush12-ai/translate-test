# WebRTC Video Call App

A real-time, browser-based video calling application built with WebRTC for peer-to-peer video/audio communication.

## Architecture

This is a **pnpm monorepo** with the following structure:

```
/
├── artifacts/
│   ├── api-server/     # Express + WebSocket signaling server (port 8080)
│   └── video-call/     # React frontend (port 5000)
├── lib/
│   ├── api-spec/       # OpenAPI spec + Orval codegen config
│   ├── api-zod/        # Generated Zod schemas
│   ├── api-client-react/ # Generated React Query hooks
│   └── db/             # Drizzle ORM schema + PostgreSQL client
├── pnpm-workspace.yaml # Monorepo workspace + catalog versions
├── package.json        # Root package with shared scripts
├── start.sh            # Dev startup script
└── start-prod.sh       # Production startup script
```

## Technologies

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Shadcn UI (Radix UI), TanStack Query, Wouter
- **Backend**: Node.js, Express v5, WebSocket (ws), Pino logging, esbuild
- **Database**: PostgreSQL, Drizzle ORM (optional — falls back to in-memory if no DATABASE_URL)
- **API**: OpenAPI spec → Orval-generated Zod schemas and React Query hooks
- **Real-time**: WebRTC with WebSocket signaling

## Running the App

The app uses a single workflow that starts both servers:

```bash
bash /home/runner/workspace/start.sh
```

- **Frontend** → `http://0.0.0.0:5000` (Vite dev server, proxies `/api` and `/ws` to the API)
- **API server** → `http://127.0.0.1:8080`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (optional). If not set, rooms are stored in memory.
- `PORT` — Override for the API server port (default: 8080)

## Key Features

- Create and join video call rooms
- WebRTC peer-to-peer video/audio with STUN servers
- Screen sharing with host-approval flow
- Password-protected rooms
- Real-time WebSocket signaling

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
