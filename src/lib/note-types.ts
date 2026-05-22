export const NOTE_TYPES = [
  "dream",
  "idea",
  "reminder",
  "thought",
  "journal",
  "other"
] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  dream: "חלום",
  idea: "רעיון",
  reminder: "תזכורת",
  thought: "מחשבה",
  journal: "יומן",
  other: "אחר"
};

export function isNoteType(value: unknown): value is NoteType {
  return typeof value === "string" && NOTE_TYPES.includes(value as NoteType);
}
