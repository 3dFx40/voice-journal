import { describe, expect, it, vi } from "vitest";
import { createNote } from "@/lib/notes";
import { POST } from "./route";

vi.mock("@/lib/notes", () => ({
  createNote: vi.fn(),
  isNoteType: (type: unknown) =>
    ["dream", "idea", "reminder", "thought", "journal", "other"].includes(
      String(type)
    ),
  listNotes: vi.fn()
}));

describe("POST /api/notes", () => {
  it("returns the saved note after creating it", async () => {
    const savedNote = {
      id: "note-1",
      type: "reminder",
      transcript: "Call tomorrow",
      title: "Follow up",
      tags: ["calls"],
      createdAt: "2026-05-24T12:00:00.000Z",
      updatedAt: "2026-05-24T12:00:00.000Z"
    };
    vi.mocked(createNote).mockResolvedValueOnce(savedNote);

    const response = await POST(
      new Request("http://localhost/api/notes", {
        method: "POST",
        body: JSON.stringify({
          type: "reminder",
          transcript: "Call tomorrow",
          title: "Follow up",
          tags: ["calls"]
        }),
        headers: { "Content-Type": "application/json" }
      }) as never
    );

    await expect(response.json()).resolves.toEqual({ note: savedNote });
    expect(response.status).toBe(201);
    expect(createNote).toHaveBeenCalledWith({
      type: "reminder",
      transcript: "Call tomorrow",
      title: "Follow up",
      tags: ["calls"]
    });
  });
});
