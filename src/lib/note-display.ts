import { NOTE_TYPE_LABELS, type NoteType } from "./note-types";

export type ExportableNote = {
  createdAt: string;
  updatedAt?: string;
  type: NoteType;
  transcript: string;
  title?: string;
  tags?: string[];
};

export function getNoteListTitle(note: {
  title?: string;
  type: NoteType;
  transcript?: string;
}) {
  return note.title?.trim() ?? "";
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
    "",
    note.transcript.trim()
  ];

  return lines.filter((line) => line !== undefined).join("\n");
}

export function getExportedNotesText(
  notes: ExportableNote[],
  exportedAt = new Date().toISOString()
) {
  const header = [
    "פנקס אישי - ייצוא מלא",
    `נוצר בתאריך: ${exportedAt}`,
    `מספר פתקים: ${notes.length}`
  ];

  if (notes.length === 0) {
    return [...header, "", "אין פתקים שמורים."].join("\n");
  }

  const noteBlocks = notes.map((note, index) => {
    const title = note.title?.trim() || "ללא שם";
    const lines = [
      `${index + 1}. ${title}`,
      `סוג: ${NOTE_TYPE_LABELS[note.type]}`,
      `נוצר: ${note.createdAt}`,
      note.updatedAt ? `עודכן: ${note.updatedAt}` : undefined,
      "",
      "תוכן:",
      note.transcript.trim()
    ];

    return lines.filter((line) => line !== undefined).join("\n");
  });

  return [...header, "", ...noteBlocks.map((block) => `---\n${block}`)].join("\n");
}
