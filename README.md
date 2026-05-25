# פנקס אישי

פנקס אישי הוא פנקס פרטי בעברית להקלטה, תמלול ושמירה של מחשבות, חלומות, תזכורות, רעיונות ורשומות אישיות בארכיון שאפשר לחפש בו.

The app is installable on Android as a PWA. It can run locally with file storage, or on Vercel with Supabase Postgres storage.

## Stack

- Next.js with TypeScript
- Installable PWA manifest and service worker
- Browser `MediaRecorder` for microphone recording
- OpenAI-compatible audio transcription endpoint
- Local JSON file storage under `app-storage/` in development
- Supabase Postgres storage for deployed notes on Vercel

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000.

On Windows PowerShell, create `.env` manually or run:

```powershell
Copy-Item .env.example .env
```

## Environment Variables

- `OPENAI_API_KEY`: optional. When set, `/api/transcribe` sends recordings to OpenAI for Hebrew transcription.
- `OPENAI_TRANSCRIPTION_MODEL`: optional. Defaults to `gpt-4o-mini-transcribe`.
- `VOICE_JOURNAL_DATA_DIR`: optional. Defaults to `app-storage`.
- `VOICE_JOURNAL_STORAGE`: optional. Use `filesystem` locally or `supabase` in deployment.
- `SUPABASE_URL`: required when `VOICE_JOURNAL_STORAGE=supabase`.
- `SUPABASE_SECRET_KEY`: required for Vercel/Supabase deployment. Use a server-only Supabase secret key (`sb_secret_...`) or the legacy `service_role` key via `SUPABASE_SERVICE_ROLE_KEY`.
- `VOICE_JOURNAL_BASIC_AUTH_USER`: optional. When set together with `VOICE_JOURNAL_BASIC_AUTH_PASSWORD`, protects the app with HTTP Basic Auth.
- `VOICE_JOURNAL_BASIC_AUTH_PASSWORD`: optional. Use this on public deployments so the journal is not open to anyone with the URL.
- `HERMES_WEBHOOK_URL`: optional server-side Hermes Agent webhook URL. When set, new notes notify Hermes after they are saved.
- `HERMES_WEBHOOK_SECRET`: required when `HERMES_WEBHOOK_URL` is set. Used server-side to sign the exact webhook JSON body with HMAC-SHA256.
- `HERMES_WEBHOOK_ENABLED`: optional. Defaults to enabled when `HERMES_WEBHOOK_URL` exists; set to `false` to disable sending.

If `OPENAI_API_KEY` is not configured, the app stays usable: after recording, it shows a clear manual transcription message and lets you type/edit the text before saving.

## Android Install

After deployment over HTTPS, open the Vercel URL in Chrome on Android and choose **Install app** or **Add to Home screen** from the browser menu. The app uses standalone display mode and caches the shell for a native-app-like launch.

## Supabase Setup

Create a Supabase project, open the SQL editor, and run:

```sql
create table if not exists public.voice_notes (
  id uuid primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  type text not null check (
    type in ('dream', 'idea', 'reminder', 'thought', 'journal', 'other')
  ),
  transcript text not null,
  title text,
  tags text[] not null default '{}'
);

create index if not exists voice_notes_created_at_idx
  on public.voice_notes (created_at desc);

create index if not exists voice_notes_type_idx
  on public.voice_notes (type);

alter table public.voice_notes enable row level security;
```

The same schema is available at `supabase/schema.sql`.

## Vercel Deploy

The project includes `vercel.json` for the PWA headers. Vercel detects Next.js automatically and runs `npm run build`.

Set these environment variables in Vercel:

```text
OPENAI_API_KEY=...
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
VOICE_JOURNAL_STORAGE=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
VOICE_JOURNAL_BASIC_AUTH_USER=...
VOICE_JOURNAL_BASIC_AUTH_PASSWORD=...
HERMES_WEBHOOK_URL=...
HERMES_WEBHOOK_SECRET=...
HERMES_WEBHOOK_ENABLED=true
```

Do not expose the Supabase server key or Hermes webhook values with a `NEXT_PUBLIC_` prefix. The app only uses them from server-side Next.js API routes.

See `docs/hermes-webhook.md` for the Hermes payload, failure behavior, and a curl smoke test.

## Commands

```bash
npm run dev
npm test
npm run lint
npm run build
```

## Privacy Notes

- Transcript content is stored locally in `app-storage/notes.json` in development, and in Supabase Postgres after deployment.
- Recordings are used only temporarily for transcription and are not saved by the app.
- API keys must stay in `.env`; do not commit secrets.
- The server does not intentionally log transcript or audio content.
- A public deploy should set `VOICE_JOURNAL_BASIC_AUTH_USER` and `VOICE_JOURNAL_BASIC_AUTH_PASSWORD`.

## Storage Tradeoff

Local development uses JSON file storage instead of SQLite to keep the MVP small and easy to inspect. Vercel deployment uses Supabase Postgres because serverless filesystems are not persistent application storage.

The note model and API routes are isolated in `src/lib/notes.ts` and `src/app/api/*`, so a later migration to SQLite, Postgres, or another store can preserve the UI and API shape.

## Known Limitations

- No user accounts or multi-user isolation.
- No Google Drive sync.
- Search is basic text matching, not semantic search.
- Saved notes contain text and metadata only, not recording files.
- Browser recording support depends on `MediaRecorder` availability and microphone permissions.

## Later: Google Drive

Do not implement in this MVP, but the future export/sync shape should support:

```text
פנקס אישי/
  Transcripts/
  Dreams/
  Ideas/
  Reminders/
```

Future Drive work:

- Export saved notes to Google Drive.
- Create per-type folders for transcripts.
- Add conflict handling and explicit user-controlled sync.

## Later: AI Features

Do not implement in this MVP. Good next AI additions:

- Automatic summary
- Automatic tags
- Automatic type detection
- Reminder extraction
- Dream pattern analysis
- Semantic search
