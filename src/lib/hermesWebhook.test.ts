import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { sendNoteCreatedToHermes } from "./hermesWebhook";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

describe("sendNoteCreatedToHermes", () => {
  it("does nothing when no webhook URL is configured", async () => {
    delete process.env.HERMES_WEBHOOK_URL;

    await sendNoteCreatedToHermes({
      id: "note-1",
      type: "reminder",
      transcript: "Buy milk",
      createdAt: "2026-05-24T12:00:00.000Z",
      tags: []
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not throw when the webhook request fails", async () => {
    process.env.HERMES_WEBHOOK_URL = "https://hermes.example/webhook";
    process.env.HERMES_WEBHOOK_SECRET = "secret-value";
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendNoteCreatedToHermes({
        id: "note-2",
        type: "journal",
        transcript: "Personal note",
        createdAt: "2026-05-24T12:00:00.000Z",
        tags: []
      })
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "Hermes webhook failed:",
      expect.any(Error)
    );
  });

  it("does nothing when the webhook secret is missing", async () => {
    process.env.HERMES_WEBHOOK_URL = "https://hermes.example/webhook";
    delete process.env.HERMES_WEBHOOK_SECRET;

    await expect(
      sendNoteCreatedToHermes({
        id: "note-missing-secret",
        type: "reminder",
        transcript: "Do not send unsigned payloads",
        createdAt: "2026-05-24T12:00:00.000Z",
        tags: []
      })
    ).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the focused note payload signed with HMAC-SHA256", async () => {
    process.env.HERMES_WEBHOOK_URL = "https://hermes.example/webhook";
    process.env.HERMES_WEBHOOK_SECRET = "secret-value";
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await sendNoteCreatedToHermes({
      id: "note-3",
      type: "idea",
      title: "New direction",
      transcript: "Keep the payload small",
      createdAt: "2026-05-24T12:00:00.000Z",
      tags: ["product"]
    });

    const body = JSON.stringify({
      event_type: "voice_journal.note_created",
      noteId: "note-3",
      type: "idea",
      title: "New direction",
      tags: ["product"],
      transcript: "Keep the payload small",
      createdAt: "2026-05-24T12:00:00.000Z"
    });
    const signature = crypto
      .createHmac("sha256", "secret-value")
      .update(body)
      .digest("hex");

    expect(fetch).toHaveBeenCalledWith(
      "https://hermes.example/webhook",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Request-ID": "note-3"
        },
        body
      })
    );
  });
});
