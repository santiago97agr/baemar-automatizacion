<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Business domain: BAEMAR

The application processes professional communications and coordinates clients, communications, tasks, and attachments.

### Core entities

* **Client**: a person or organization served by the firm.
* **Task**: an actual action that the firm needs to perform.
* **Communication**: an incoming or outgoing message, independently of its channel.
* **Attachment**: a file associated with a communication and, where applicable, a client or task.

A communication must not automatically create a task. Multiple communications may belong to the same task, and a task may exist before any communication is received.

### Communication processing rules

1. Check for duplicate messages before performing external side effects.
2. Identify the client using available contact information and reliable contextual evidence.
3. Classify whether the communication is relevant and whether it requires an action.
4. If an action is required, retrieve the client's open tasks before deciding whether to create a new task.
5. Link a communication to an existing task only when the relationship is sufficiently clear.
6. Create a new task when a new action is identified and no existing task matches.
7. If the client or task relationship is ambiguous, mark the communication for human review.
8. Never merge unrelated client matters solely because their subjects or text are similar.
9. Do not invent deadlines, client identities, assignments, or other missing facts.
10. Keep communication history even when a new task is not required, according to the agreed relevance and retention policies.

### Notion data model

The target structure consists of three related databases:

* CLIENTS (source of truth for clients)
* TASKS
* COMMUNICATIONS

Use Notion relations to connect clients to their tasks and communications, and tasks to their related communications.

Keep stable internal IDs and Notion page IDs where needed to support synchronization and updates.

### Client source of truth

- `Client` in SQLite is a read-only mirror of the CLIENTS Notion database.
- During processing, the pipeline queries Notion by sender email and caches the result for 5 minutes.
- If the client is not found in Notion or multiple matches exist, the communication is left unassigned and flagged for review.
- Manual assignment uses a live Notion search (`GET /api/clients?q=...`); there is no local client CRUD.
- Backfill all clients from Notion via `POST /api/clients/sync`.

### Dropbox integration

* Store approved attachments in the configured Dropbox workspace.
* Organize files by stable client identifier and date.
* Persist file metadata and storage references in the local database.
* Avoid accidental overwrites and duplicate uploads.
* Do not use public links by default.
* Handle upload failures with retryable processing states.

### Reliability and synchronization

* Keep processing idempotent.
* Separate AI classification from external synchronization.
* Track processing status, retry attempts, and integration errors.
* Avoid duplicate Notion pages when a synchronization attempt is repeated.
* Do not lose a locally recorded communication when Notion or Dropbox is temporarily unavailable.
* Preserve auditability of automated decisions and human corrections.

### Future channel support

Email is the initial input channel. WhatsApp may be added later using the same Communication and Task entities and the same classification and deduplication rules.

Do not introduce channel-specific task databases or duplicate the business logic for each channel.

## Agent notes

Stack: Next.js 16.3.5, React 19.2.8, TypeScript 5, Tailwind CSS 4, Prisma 6 (SQLite), Node 22.

### Dev commands

- `npm run dev` — dev server on `http://localhost:3000`.
- `npm run build` — production build.
- `npm run lint` — ESLint via the flat config in `eslint.config.mjs`.
- `npm run test` — `node:test` + `tsx` (tests en `tests/*.test.ts`).
- `npm run seed` / `npx prisma db seed` — seeds default categories.

### DB / Prisma

- Uses SQLite: `DATABASE_URL="file:./dev.db"` points to `prisma/dev.db`.
- `AiActivity` was renamed to `Communication` in Prisma but keeps the table name `AiActivity` via `@@map` to preserve data.
- Run migrations with `npx prisma migrate deploy` (or `prisma migrate dev` locally).
- Regenerate the client after schema changes: `npx prisma generate`.

### Auth model

Two separate auth layers:

1. **UI routes** — Basic Auth via `proxy.ts` (Next.js 16 proxy) and `lib/auth.ts`. Credentials come from `AUTH_USER` / `AUTH_PASSWORD`.
2. **Internal API routes** (`/api/process`, `/api/context`, `/api/webhook`, `/api/errors`) — bypass Basic Auth in the proxy and validate `x-internal-token` against `INTERNAL_API_TOKEN` in each route.

`proxy.ts` is the source of truth for the UI auth boundary; keep its `INTERNAL_PATHS` list updated.

### App architecture

- App Router under `app/`.
- Dashboard is `app/page.tsx`; pages: `/tareas`, `/tareas/[id]`, `/items/[id]`, `/configuracion`, etc.
- Client CRUD pages (`/clientes`, `/clientes/[id]`) were removed; clients are managed in Notion.
- Ingestion entry point: `POST /api/process` → pipeline in `lib/processing/`.
- Pipeline: dedupe → identify client (Notion lookup) → classify with IA → decide → attachments → Notion sync.
- Notion sync lives in `lib/sync/notion-sync.ts` and uses 3 DBs: CLIENTS, TASKS, COMMUNICATIONS.
- Client mirror logic lives in `lib/sync/notion-clients.ts`.
- Dropbox integration in `lib/integrations/dropbox.ts`; attachments tracked in the `Attachment` table.
- Healthchecks for AI, Notion and Dropbox under `/api/config/check/*`.
- ERP integration remains the outbox pattern via `/api/outbox`.

### Environment variables

Key vars: `DATABASE_URL`, `NOTION_TOKEN`, `NOTION_CLIENTS_DB_ID`, `NOTION_TASKS_DB_ID`, `NOTION_COMMUNICATIONS_DB_ID`, `AUTH_USER`, `AUTH_PASSWORD`, `INTERNAL_API_TOKEN`, `INTEGRATIONS`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_ROOT_FOLDER`, `DROPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_APP_URL`.

`.env` is currently committed; rotate tokens before production.

### Tailwind / styling

- Tailwind CSS v4 via `@tailwindcss/postcss`.
- Theme tokens in `app/globals.css` using `@theme` and custom `@utility` classes.
- Path alias `@/*` maps to repo root.

### Codegen / generated files

- Prisma migrations are incremental SQL in `prisma/migrations/`.
- `@prisma/client` is generated; run `npx prisma generate` after schema edits.
- The Next.js agent-rules block at the top of this file is auto-managed by `next dev`; keep it.

### Testing

- `node:test` + `tsx` with a real SQLite test DB (`prisma/test.db`).
- Tests cover the pipeline, idempotency, Notion/Dropbox error recovery, and manual correction preservation.
