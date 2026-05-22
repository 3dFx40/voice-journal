# Voice Journal

Voice Journal is a small Hebrew-first private voice notebook. You can record a thought, dream, reminder, idea, or journal entry in the browser, transcribe it, edit the text, and save it into a searchable archive.

The app is installable on Android as a PWA. It can run locally with file storage, or on Netlify with Netlify Blobs storage.

## Stack

- Next.js with TypeScript
- Installable PWA manifest and service worker
- Browser `MediaRecorder` for microphone recording
- OpenAI-compatible audio transcription endpoint
- Local JSON file storage under `app-storage/` in development
- Netlify Blobs storage for deployed notes and saved audio on Netlify

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
- `VOICE_JOURNAL_STORAGE`: optional. Use `filesystem` locally or `netlify-blobs` to force Netlify Blobs storage. On Netlify, Blobs storage is selected automatically.
- `VOICE_JOURNAL_BASIC_AUTH_USER`: optional. When set together with `VOICE_JOURNAL_BASIC_AUTH_PASSWORD`, protects the app with HTTP Basic Auth.
- `VOICE_JOURNAL_BASIC_AUTH_PASSWORD`: optional. Use this on public deployments so the journal is not open to anyone with the URL.

If `OPENAI_API_KEY` is not configured, the app stays usable: after recording, it shows a clear manual transcription message and lets you type/edit the text before saving.

## Android Install

After deployment over HTTPS, open the Netlify URL in Chrome on Android and choose **Install app** or **Add to Home screen** from the browser menu. The app uses standalone display mode and caches the shell for a native-app-like launch.

## Netlify Deploy

The project includes `netlify.toml` with `npm run build` and Node 22. Netlify's current Next.js support uses the OpenNext adapter automatically, so the project does not pin `@netlify/plugin-nextjs`.

Set these environment variables in Netlify:

```text
OPENAI_API_KEY=...
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
VOICE_JOURNAL_BASIC_AUTH_USER=...
VOICE_JOURNAL_BASIC_AUTH_PASSWORD=...
```

Netlify automatically provides the Blobs runtime. Notes are stored in the site-scoped `voice-journal` store, and saved audio is stored under `uploads/`.

## Commands

```bash
npm run dev
npm test
npm run lint
npm run build
```

## Privacy Notes

- Transcript content is stored locally in `app-storage/notes.json` in development, and in Netlify Blobs after deployment.
- Audio is only saved if you check "לשמור גם את קובץ האודיו".
- Audio files are stored locally under `app-storage/uploads/` in development, and in Netlify Blobs after deployment.
- API keys must stay in `.env`; do not commit secrets.
- The server does not intentionally log transcript or audio content.
- A public deploy should set `VOICE_JOURNAL_BASIC_AUTH_USER` and `VOICE_JOURNAL_BASIC_AUTH_PASSWORD`.

## Storage Tradeoff

Local development uses JSON file storage instead of SQLite to keep the MVP small and easy to inspect. Netlify deployment uses Netlify Blobs because serverless filesystems are not persistent application storage.

The note model and API routes are isolated in `src/lib/notes.ts` and `src/app/api/*`, so a later migration to SQLite, Postgres, or another store can preserve the UI and API shape.

## Known Limitations

- No user accounts or multi-user isolation.
- No Google Drive sync.
- Search is basic text matching, not semantic search.
- Audio files are not deleted from storage when deleting a note in this MVP.
- Browser recording support depends on `MediaRecorder` availability and microphone permissions.

## Later: Google Drive

Do not implement in this MVP, but the future export/sync shape should support:

```text
Voice Journal/
  Audio/
  Transcripts/
  Dreams/
  Ideas/
  Reminders/
```

Future Drive work:

- Export saved notes to Google Drive.
- Upload saved audio files.
- Create per-type folders for transcripts and audio.
- Add conflict handling and explicit user-controlled sync.

## Later: AI Features

Do not implement in this MVP. Good next AI additions:

- Automatic summary
- Automatic tags
- Automatic type detection
- Reminder extraction
- Dream pattern analysis
- Semantic search
