import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getDeployStore, getStore } from "@netlify/blobs";
import { NOTE_TYPE_LABELS, NOTE_TYPES, type NoteType, isNoteType } from "./note-types";

export { NOTE_TYPE_LABELS, NOTE_TYPES, isNoteType };
export type { NoteType };

export type VoiceNote = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: NoteType;
  transcript: string;
  title?: string;
  tags: string[];
};

export type NoteInput = {
  type: NoteType;
  transcript: string;
  title?: string;
  tags?: string[];
};

export type NoteUpdate = Partial<
  Pick<VoiceNote, "type" | "transcript" | "title" | "tags">
>;

export type NoteFilters = {
  search?: string;
  type?: NoteType | "all";
};

export function getDataDir() {
  return process.env.VOICE_JOURNAL_DATA_DIR ?? join(process.cwd(), "app-storage");
}

export function shouldUseNetlifyBlobs() {
  return (
    process.env.VOICE_JOURNAL_STORAGE === "netlify-blobs" ||
    process.env.NETLIFY === "true"
  );
}

export async function listNotes(filters: NoteFilters = {}, dataDir = getDataDir()) {
  const notes = await readNotes(dataDir);
  const search = filters.search?.trim().toLocaleLowerCase("he");

  return notes
    .filter((note) => {
      if (filters.type && filters.type !== "all" && note.type !== filters.type) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        note.title ?? "",
        note.transcript,
        NOTE_TYPE_LABELS[note.type],
        ...note.tags
      ]
        .join(" ")
        .toLocaleLowerCase("he");

      return haystack.includes(search);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getNote(id: string, dataDir = getDataDir()) {
  const notes = await readNotes(dataDir);
  return notes.find((note) => note.id === id) ?? null;
}

export async function createNote(input: NoteInput, dataDir = getDataDir()) {
  const notes = await readNotes(dataDir);
  const now = new Date().toISOString();
  const note: VoiceNote = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    type: input.type,
    transcript: input.transcript.trim(),
    title: cleanOptional(input.title),
    tags: normalizeTags(input.tags)
  };

  validateNoteInput(note);
  await writeNotes([note, ...notes], dataDir);
  return note;
}

export async function updateNote(id: string, update: NoteUpdate, dataDir = getDataDir()) {
  const notes = await readNotes(dataDir);
  const index = notes.findIndex((note) => note.id === id);

  if (index === -1) {
    return null;
  }

  const previous = notes[index];
  const updated: VoiceNote = {
    ...previous,
    ...update,
    title: update.title === undefined ? previous.title : cleanOptional(update.title),
    transcript:
      update.transcript === undefined ? previous.transcript : update.transcript.trim(),
    tags: update.tags === undefined ? previous.tags : normalizeTags(update.tags),
    updatedAt: nextTimestamp(previous.updatedAt)
  };

  validateNoteInput(updated);
  notes[index] = updated;
  await writeNotes(notes, dataDir);
  return updated;
}

export async function deleteNote(id: string, dataDir = getDataDir()) {
  const notes = await readNotes(dataDir);
  const remaining = notes.filter((note) => note.id !== id);

  if (remaining.length === notes.length) {
    return false;
  }

  await writeNotes(remaining, dataDir);
  return true;
}

async function readNotes(dataDir: string): Promise<VoiceNote[]> {
  if (shouldUseNetlifyBlobs()) {
    const notes = await getVoiceJournalStore().get("notes.json", { type: "json" });
    return Array.isArray(notes) ? normalizeStoredNotes(notes) : [];
  }

  try {
    const raw = await readFile(notesPath(dataDir), "utf8");
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? normalizeStoredNotes(parsed) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeNotes(notes: VoiceNote[], dataDir: string) {
  if (shouldUseNetlifyBlobs()) {
    await getVoiceJournalStore().setJSON("notes.json", notes);
    return;
  }

  const path = notesPath(dataDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(notes, null, 2), "utf8");
}

function getVoiceJournalStore() {
  if (
    process.env.NETLIFY === "true" &&
    process.env.CONTEXT &&
    process.env.CONTEXT !== "production"
  ) {
    return getDeployStore({ name: "voice-journal" });
  }

  return getStore({ name: "voice-journal", consistency: "strong" });
}

function notesPath(dataDir: string) {
  return join(dataDir, "notes.json");
}

function normalizeStoredNotes(notes: unknown[]) {
  return notes
    .map((note) => normalizeStoredNote(note))
    .filter((note): note is VoiceNote => note !== null);
}

function normalizeStoredNote(note: unknown): VoiceNote | null {
  if (!note || typeof note !== "object") {
    return null;
  }

  const candidate = note as Partial<VoiceNote>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    !isNoteType(candidate.type) ||
    typeof candidate.transcript !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    type: candidate.type,
    transcript: candidate.transcript,
    title: cleanOptional(candidate.title),
    tags: normalizeTags(candidate.tags)
  };
}

function cleanOptional(value?: string) {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function normalizeTags(tags?: string[]) {
  return Array.from(
    new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))
  );
}

function validateNoteInput(note: VoiceNote) {
  if (!isNoteType(note.type)) {
    throw new Error("Invalid note type");
  }

  if (!note.transcript) {
    throw new Error("Transcript is required");
  }
}

function nextTimestamp(previousTimestamp: string) {
  const now = Date.now();
  const previous = Date.parse(previousTimestamp);
  const next = Number.isFinite(previous) ? Math.max(now, previous + 1) : now;
  return new Date(next).toISOString();
}
