# Hermes Webhook

After a note is saved successfully, the server sends a best-effort webhook to Hermes Agent so Hermes can analyze the new note or reminder. The app only notifies Hermes; it does not give Hermes direct Supabase access and does not create calendar events itself.

## Required Environment Variables

Set these in Vercel environment variables:

```text
HERMES_WEBHOOK_URL=https://...
HERMES_WEBHOOK_SECRET=...
HERMES_WEBHOOK_ENABLED=true
```

`HERMES_WEBHOOK_ENABLED` is optional. If it is set to `false`, no webhook is sent. If `HERMES_WEBHOOK_URL` is missing, no webhook is sent.

`HERMES_WEBHOOK_SECRET` is required when the URL is configured. The server signs the exact JSON body string with HMAC-SHA256 and sends the hex digest in `X-Webhook-Signature`.

Do not expose these as `NEXT_PUBLIC_*` variables. The webhook URL and signing secret must stay server-side only.

## Payload

```json
{
  "event_type": "voice_journal.note_created",
  "noteId": "note-123",
  "type": "reminder",
  "title": "Call tomorrow",
  "tags": ["calls"],
  "transcript": "Call Dana tomorrow at 10",
  "createdAt": "2026-05-24T12:00:00.000Z"
}
```

The payload is intentionally focused on the saved note. It does not include note history.

## Failure Behavior

Webhook delivery is best-effort. If Hermes is unavailable, times out, or returns a non-success response, the server logs the error and note creation still succeeds.

## Manual Test

Use this curl command to test the Hermes webhook directly:

```bash
BODY='{"event_type":"voice_journal.note_created","noteId":"manual-test-note","type":"reminder","title":"Manual webhook test","tags":["test"],"transcript":"This is a manual Hermes webhook smoke test.","createdAt":"2026-05-24T12:00:00.000Z"}'
SIGNATURE=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$HERMES_WEBHOOK_SECRET" -hex | sed 's/^.* //')

curl -X POST "$HERMES_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Request-ID: manual-test-note" \
  -d "$BODY"
```

For app-level verification, set the environment variables locally or in Vercel, create a note, confirm the note is saved, and then check server logs and Hermes/Telegram for the received event.
