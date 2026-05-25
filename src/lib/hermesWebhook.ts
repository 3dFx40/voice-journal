import crypto from "node:crypto";

type HermesWebhookNote = {
  id?: string;
  type?: string;
  title?: string | null;
  tags?: string[];
  transcript?: string | null;
  content?: string | null;
  text?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
};

export async function sendNoteCreatedToHermes(note: HermesWebhookNote) {
  const webhookUrl = process.env.HERMES_WEBHOOK_URL;
  const webhookSecret = process.env.HERMES_WEBHOOK_SECRET;
  const enabled = process.env.HERMES_WEBHOOK_ENABLED !== "false";

  if (!enabled || !webhookUrl || !webhookSecret) {
    return;
  }

  try {
    const body = JSON.stringify({
      event_type: "voice_journal.note_created",
      noteId: note.id,
      type: note.type,
      title: note.title,
      tags: note.tags || [],
      transcript: note.transcript || note.content || note.text || "",
      createdAt: note.created_at || note.createdAt || new Date().toISOString()
    });
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Request-ID": String(note.id || Date.now())
      },
      body
    });

    if (!response.ok) {
      console.error("Hermes webhook failed:", response.status, await response.text());
    }
  } catch (error) {
    console.error("Hermes webhook failed:", error);
  }
}
