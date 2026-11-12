# Node-RED Dashboard

Next.js (App Router) dashboard where business users configure **intents** and map them to Node-RED **steps**.
Phases 1-2: sign-in and `Knowledge > Custom` (list, search, create, edit, delete). Other sidebar entries are placeholders. The Tags column is rendered disabled until the tags backend exists (Phase 3).

## Requirements

- Node.js 20.19+ (developed on 22)
- Running `node-red-auth` (issues the JWT) and `node-red-api-gateway`

## Run

```bash
cp .env.example .env.local   # then adjust the URLs
npm install
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit + component tests) |

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_SERVICE_URL` | `http://localhost:4001` | node-red-auth base URL (`POST /auth/login`) |
| `GATEWAY_URL` | `http://localhost:8080` | node-red-api-gateway base URL |
| `SETTINGS_URL` | `http://localhost:3002` | settings-node-red base URL (steps catalog, `GET /api/steps`) |
| `SETTINGS_API_KEY` | _(empty)_ | Sent as `x-api-key` to settings-node-red; must match its `API_KEY` |
| `COOKIE_SECURE` | `true` in production | Override the session cookie `secure` flag |

No secrets are needed: the dashboard never sees the JWT signing secret.

## How it works

- **Sign-in**: `/login` calls the auth service from a Server Action and stores `accessToken` in an httpOnly, `sameSite=lax` cookie (`secure` in production) whose `maxAge` matches the token `exp` (default 15 minutes; there is no silent refresh).
- **Route protection**: `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`) redirects to `/login` when the cookie is missing or expired. This is an optimistic check only.
- **UI permissions**: the JWT payload is decoded (not verified) to read `permissions` (`READ` | `WRITE` | `ADMIN`). `WRITE`/`ADMIN` enable create and edit; `ADMIN` enables delete. The gateway stays the authority and its 403 is shown to the user.
- **Gateway access**: server-side only (`src/lib/gateway`). Responses are parsed with zod. HTTP errors are mapped in one place (`client.ts`): 401 clears the cookie and redirects to `/login`, 403 shows "no permission", 400/409/422 become field errors.
- **Mutations**: Server Actions + `revalidatePath`.

## Layout

```
src/
  proxy.ts                         route protection
  app/login/                       sign-in page + actions
  app/session-expired/route.ts     clears the cookie, redirects to /login
  app/(dashboard)/                 authenticated shell (sidebar)
    knowledge/custom/              page, loading/error states, server actions
    users/                         users admin page + server actions (ADMIN only)
  components/                      intents table, dialogs, keyword chip input, sidebar, shadcn/ui
  lib/auth/                        JWT decoding, session cookie, auth-service client
  lib/gateway/                     typed gateway client, zod schemas, server helper
  lib/users/                       users client (gateway /api/admin/users), access levels, form schemas
  lib/intents/                     form schema (mirrors backend rules), search/tag filter, CSV/JSON import (parse, validate, run)
```

## Importing intents

Knowledge > Custom > **Import** accepts a CSV or JSON file (max 200 rows, 1 MB). Templates can be downloaded from the dialog.

- CSV header: `intent,initialStep,keywords,description,tags` (`description` and `tags` optional; `keywords` and `tags` separated by `|`; comma or semicolon delimiter).
- JSON: an array of objects with the same keys; `keywords` and `tags` can be arrays or `|`-separated strings.

Rows are validated in the browser with the same schema as the intent form. Valid rows are created sequentially (in batches of 25) through the existing create endpoint; each row ends as created, duplicate (409) or error.

## Users

The **Usuarios** page (`/users`, sidebar entry visible to `ADMIN` only) is a CRUD over the gateway's `/api/admin/users` (backed by node-red-auth): list, create, edit name/level/status, reset password and deactivate. Deactivation is soft (the account is kept and can be reactivated from the edit dialog).

Each user has one access level, stored as the backend permission set:

| Level | Label | Permissions |
| --- | --- | --- |
| `read` | Lectura | `READ` |
| `write` | Lectura y escritura | `READ`, `WRITE` |
| `admin` | Administrador | `READ`, `WRITE`, `ADMIN` |

Guard rails: an admin cannot deactivate themselves nor remove their own `ADMIN` level, and the backend refuses to remove the last active admin. As everywhere else, the UI check is only a convenience; the gateway enforces `ADMIN` on every call.

The access level currently governs the dashboard and the gateway only. Mapping it to Node-RED editor permissions is handled separately.
