import { NOTE_TYPE_LABELS, type NoteType } from "./note-types";

export function getNoteListTitle(note: {
  title?: string;
  type: NoteType;
  transcript?: string;
}) {
  return note.title?.trim() ?? "";
}

export function shouldShowTranscriptPreview(type: NoteType) {
  return type === "journal" || type === "reminder";
}

export function getCopyableNoteText(note: {
  title?: string;
  type: NoteType;
  tags?: string[];
  transcript: string;
}) {
  const lines = [
    note.title?.trim(),
    `סוג: ${NOTE_TYPE_LABELS[note.type]}`,
    note.tags?.length ? `תגיות: ${note.tags.join(", ")}` : undefined,
    "",
    note.transcript.trim()
  ];

  return lines.filter((line) => line !== undefined).join("\n");
}
