import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  NOTE_TYPE_LABELS,
  updateNote
} from "./notes";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "voice-journal-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("notes storage", () => {
  it("creates notes with timestamps and Hebrew type labels", async () => {
    const note = await createNote(
      {
        type: "dream",
        transcript: "חלמתי על גשם בירושלים",
        title: "חלום גשם",
        tags: ["חלום", "גשם"]
      },
      dataDir
    );

    expect(note.id).toHaveLength(36);
    expect(note.createdAt).toEqual(note.updatedAt);
    expect(NOTE_TYPE_LABELS[note.type]).toBe("חלום");

    await expect(getNote(note.id, dataDir)).resolves.toMatchObject({
      transcript: "חלמתי על גשם בירושלים",
      type: "dream"
    });
  });

  it("lists newest first and filters by transcript text and type", async () => {
    await createNote(
      {
        type: "idea",
        transcript: "רעיון לאפליקציה קטנה"
      },
      dataDir
    );
    await createNote(
      {
        type: "reminder",
        transcript: "לקנות חלב בדרך הביתה"
      },
      dataDir
    );

    const searchResults = await listNotes({ search: "חלב" }, dataDir);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].type).toBe("reminder");

    const typeResults = await listNotes({ type: "idea" }, dataDir);
    expect(typeResults).toHaveLength(1);
    expect(typeResults[0].transcript).toContain("אפליקציה");
  });

  it("updates and deletes notes without losing createdAt", async () => {
    const note = await createNote(
      {
        type: "thought",
        transcript: "מחשבה ראשונה"
      },
      dataDir
    );

    const updated = await updateNote(
      note.id,
      {
        type: "journal",
        transcript: "ערך יומן מעודכן",
        tags: ["ערב"]
      },
      dataDir
    );

    expect(updated?.createdAt).toBe(note.createdAt);
    expect(updated?.updatedAt).not.toBe(note.updatedAt);
    expect(updated?.type).toBe("journal");

    await expect(deleteNote(note.id, dataDir)).resolves.toBe(true);
    await expect(getNote(note.id, dataDir)).resolves.toBeNull();
  });

  it("stores notes as text only", async () => {
    const note = await createNote(
      {
        type: "thought",
        transcript: "פתק בלי שמירת הקלטה"
      },
      dataDir
    );

    expect(note).not.toHaveProperty("audioPath");
    expect(note).not.toHaveProperty("keepAudio");
  });
});
