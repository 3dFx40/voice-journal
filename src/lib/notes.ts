import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sendNoteCreatedToHermes } from "./hermesWebhook";
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

type SupabaseNoteRow = {
  id: string;
  created_at: string;
  updated_at: string;
  type: unknown;
  transcript: string;
  title: string | null;
  tags: unknown;
};

export function getDataDir() {
  return process.env.VOICE_JOURNAL_DATA_DIR ?? join(process.cwd(), "app-storage");
}

export function shouldUseSupabase() {
  return (
    process.env.VOICE_JOURNAL_STORAGE === "supabase" ||
    Boolean(process.env.SUPABASE_URL && getSupabaseKey())
  );
}

function assertConfiguredStorage() {
  if (
    process.env.VOICE_JOURNAL_STORAGE === "file" ||
    process.env.NODE_ENV !== "production"
  ) {
    return;
  }

  if (!shouldUseSupabase()) {
    throw new Error("Production storage requires Supabase configuration");
  }
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
  if (shouldUseSupabase()) {
    return readSupabaseNote(id);
  }

  const notes = await readNotes(dataDir);
  return notes.find((note) => note.id === id) ?? null;
}

export async function createNote(input: NoteInput, dataDir = getDataDir()) {
  assertConfiguredStorage();

  const notes = shouldUseSupabase() ? [] : await readFileNotes(dataDir);
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

  if (shouldUseSupabase()) {
    return createSupabaseNote(note);
  }

  await writeFileNotes([note, ...notes], dataDir);
  return note;
}

export async function updateNote(id: string, update: NoteUpdate, dataDir = getDataDir()) {
  const previous = await getNote(id, dataDir);

  if (!previous) {
    return null;
  }

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

  if (shouldUseSupabase()) {
    return updateSupabaseNote(id, updated);
  }

  const notes = await readFileNotes(dataDir);
  const index = notes.findIndex((note) => note.id === id);

  if (index === -1) {
    return null;
  }

  notes[index] = updated;
  await writeFileNotes(notes, dataDir);
  return updated;
}

export async function deleteNote(id: string, dataDir = getDataDir()) {
  if (shouldUseSupabase()) {
    return deleteSupabaseNote(id);
  }

  const notes = await readFileNotes(dataDir);
  const remaining = notes.filter((note) => note.id !== id);

  if (remaining.length === notes.length) {
    return false;
  }

  await writeFileNotes(remaining, dataDir);
  return true;
}

async function readNotes(dataDir: string): Promise<VoiceNote[]> {
  if (shouldUseSupabase()) {
    return readSupabaseNotes();
  }

  return readFileNotes(dataDir);
}

async function readFileNotes(dataDir: string): Promise<VoiceNote[]> {
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

async function writeFileNotes(notes: VoiceNote[], dataDir: string) {
  const path = notesPath(dataDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(notes, null, 2), "utf8");
}

async function readSupabaseNotes() {
  const rows = await supabaseRequest<SupabaseNoteRow[]>(
    "/voice_notes?select=*&order=created_at.desc"
  );
  return normalizeStoredNotes(rows.map(fromSupabaseRow));
}

async function readSupabaseNote(id: string) {
  const rows = await supabaseRequest<SupabaseNoteRow[]>(
    `/voice_notes?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ? normalizeStoredNote(fromSupabaseRow(rows[0])) : null;
}

async function createSupabaseNote(note: VoiceNote) {
  const rows = await supabaseRequest<SupabaseNoteRow[]>("/voice_notes", {
    method: "POST",
    body: JSON.stringify(toSupabaseRow(note))
  });
  const savedNote = normalizeSupabaseResult(rows[0], "Could not save note");

  sendNoteCreatedToHermes(savedNote).catch((error) => {
    console.error("Hermes webhook failed:", error);
  });

  return savedNote;
}

async function updateSupabaseNote(id: string, note: VoiceNote) {
  const rows = await supabaseRequest<SupabaseNoteRow[]>(
    `/voice_notes?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(toSupabaseUpdate(note))
    }
  );
  return rows[0] ? normalizeSupabaseResult(rows[0], "Could not update note") : null;
}

async function deleteSupabaseNote(id: string) {
  const rows = await supabaseRequest<SupabaseNoteRow[]>(
    `/voice_notes?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  return rows.length > 0;
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error("Supabase storage requires SUPABASE_URL and a server API key");
  }

  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Supabase request failed (${response.status}): ${details || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

function getSupabaseKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function normalizeSupabaseResult(row: SupabaseNoteRow | undefined, fallback: string) {
  const note = row ? normalizeStoredNote(fromSupabaseRow(row)) : null;

  if (!note) {
    throw new Error(fallback);
  }

  return note;
}

function fromSupabaseRow(row: SupabaseNoteRow): Partial<VoiceNote> {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    type: isNoteType(row.type) ? row.type : undefined,
    transcript: row.transcript,
    title: row.title ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : []
  };
}

function toSupabaseRow(note: VoiceNote): SupabaseNoteRow {
  return {
    id: note.id,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    type: note.type,
    transcript: note.transcript,
    title: note.title ?? null,
    tags: note.tags
  };
}

function toSupabaseUpdate(note: VoiceNote): Partial<SupabaseNoteRow> {
  return {
    updated_at: note.updatedAt,
    type: note.type,
    transcript: note.transcript,
    title: note.title ?? null,
    tags: note.tags
  };
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
