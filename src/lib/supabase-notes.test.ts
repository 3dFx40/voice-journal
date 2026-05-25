import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote
} from "./notes";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-24T12:00:00.000Z"));
  process.env = {
    ...originalEnv,
    VOICE_JOURNAL_STORAGE: "supabase",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
  };
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

describe("Supabase notes storage", () => {
  it("creates notes through Supabase REST with the server key", async () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
      type: "idea",
      transcript: "רעיון חדש",
      title: "כותרת",
      tags: ["מוצר"]
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([row]));

    const note = await createNote({
      type: "idea",
      transcript: " רעיון חדש ",
      title: " כותרת ",
      tags: ["מוצר"]
    });

    expect(note).toEqual({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      type: row.type,
      transcript: row.transcript,
      title: row.title,
      tags: row.tags
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/voice_notes",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "service-role-key",
          Authorization: "Bearer service-role-key",
          Prefer: "return=representation"
        })
      })
    );

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
      type: "idea",
      transcript: "רעיון חדש",
      title: "כותרת",
      tags: ["מוצר"]
    });
    expect(body.id).toHaveLength(36);
  });

  it("accepts the current Supabase secret key environment variable", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_server_key";
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));

    await listNotes();

    expect(fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/voice_notes?select=*&order=created_at.desc",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "sb_secret_server_key",
          Authorization: "Bearer sb_secret_server_key"
        })
      })
    );
  });

  it("notifies Hermes after a note is created in Supabase", async () => {
    process.env.HERMES_WEBHOOK_URL = "https://hermes.example/webhook";
    process.env.HERMES_WEBHOOK_SECRET = "secret-value";
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
      type: "idea",
      transcript: "Hermes payload text",
      title: "Webhook note",
      tags: ["product"]
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([row]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await createNote({
      type: "idea",
      transcript: "Hermes payload text",
      title: "Webhook note",
      tags: ["product"]
    });

    const body = JSON.stringify({
      event_type: "voice_journal.note_created",
      noteId: row.id,
      type: row.type,
      title: row.title,
      tags: row.tags,
      transcript: row.transcript,
      createdAt: row.created_at
    });
    const signature = crypto
      .createHmac("sha256", "secret-value")
      .update(body)
      .digest("hex");

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://hermes.example/webhook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Request-ID": row.id
        },
        body
      }
    );
  });

  it("does not block Supabase note creation when Hermes fails", async () => {
    process.env.HERMES_WEBHOOK_URL = "https://hermes.example/webhook";
    process.env.HERMES_WEBHOOK_SECRET = "secret-value";
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
      type: "journal",
      transcript: "Saved before webhook",
      title: null,
      tags: []
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([row]))
      .mockRejectedValueOnce(new Error("Hermes unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      createNote({
        type: "journal",
        transcript: "Saved before webhook"
      })
    ).resolves.toMatchObject({
      id: row.id,
      transcript: row.transcript
    });
  });

  it("lists and filters Supabase notes using the existing search behavior", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse([
        {
          id: "22222222-2222-4222-8222-222222222222",
          created_at: "2026-05-24T12:00:00.000Z",
          updated_at: "2026-05-24T12:00:00.000Z",
          type: "reminder",
          transcript: "לקנות חלב",
          title: null,
          tags: []
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          created_at: "2026-05-23T12:00:00.000Z",
          updated_at: "2026-05-23T12:00:00.000Z",
          type: "idea",
          transcript: "רעיון לאפליקציה",
          title: null,
          tags: []
        }
      ])
    );

    const notes = await listNotes({ search: "חלב", type: "reminder" });

    expect(fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/voice_notes?select=*&order=created_at.desc",
      expect.any(Object)
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      type: "reminder",
      transcript: "לקנות חלב"
    });
  });

  it("reads, updates, and deletes notes in Supabase", async () => {
    const existingRow = {
      id: "44444444-4444-4444-8444-444444444444",
      created_at: "2026-05-23T12:00:00.000Z",
      updated_at: "2026-05-23T12:00:00.000Z",
      type: "thought",
      transcript: "ישן",
      title: null,
      tags: []
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([existingRow]))
      .mockResolvedValueOnce(jsonResponse([existingRow]))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            ...existingRow,
            updated_at: "2026-05-24T12:00:00.000Z",
            type: "journal",
            transcript: "חדש",
            tags: ["ערב"]
          }
        ])
      )
      .mockResolvedValueOnce(jsonResponse([existingRow]));

    await expect(getNote(existingRow.id)).resolves.toMatchObject({
      id: existingRow.id,
      transcript: "ישן"
    });

    await expect(
      updateNote(existingRow.id, {
        type: "journal",
        transcript: "חדש",
        tags: ["ערב"]
      })
    ).resolves.toMatchObject({
      type: "journal",
      transcript: "חדש",
      tags: ["ערב"]
    });

    await expect(deleteNote(existingRow.id)).resolves.toBe(true);
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe(
      `https://project.supabase.co/rest/v1/voice_notes?id=eq.${existingRow.id}`
    );
    expect(vi.mocked(fetch).mock.calls[3][0]).toBe(
      `https://project.supabase.co/rest/v1/voice_notes?id=eq.${existingRow.id}`
    );
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}
