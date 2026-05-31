import { describe, expect, it } from "vitest";
import {
  getCopyableNoteText,
  getExportedNotesText,
  getNoteListTitle
} from "./note-display";

describe("note display helpers", () => {
  it("uses the title in the saved notes list when present", () => {
    expect(
      getNoteListTitle({
        title: "רעיון לספר",
        type: "idea"
      })
    ).toBe("רעיון לספר");
  });

  it("does not fall back to transcript text when title is missing", () => {
    expect(
      getNoteListTitle({
        transcript: "זה תמלול ארוך שלא צריך להופיע ברשימה",
        type: "dream"
      })
    ).toBe("");
  });

  it("copies title, type and full transcript", () => {
    expect(
      getCopyableNoteText({
        title: "פגישה עם דנה",
        type: "reminder",
        tags: ["עבודה", "חשוב"],
        transcript: "להתקשר מחר בבוקר"
      })
    ).toBe("פגישה עם דנה\nסוג: תזכורת\n\nלהתקשר מחר בבוקר");
  });

  it("exports all notes as readable text", () => {
    expect(
      getExportedNotesText(
        [
          {
            createdAt: "2026-05-24T10:00:00.000Z",
            updatedAt: "2026-05-24T10:01:00.000Z",
            type: "idea",
            title: "רעיון חדש",
            tags: ["עבודה"],
            transcript: "לבנות כפתור ייצוא"
          }
        ],
        "2026-05-24T10:02:00.000Z"
      )
    ).toBe(
      [
        "פנקס אישי - ייצוא מלא",
        "נוצר בתאריך: 2026-05-24T10:02:00.000Z",
        "מספר פתקים: 1",
        "",
        "---",
        "1. רעיון חדש",
        "סוג: רעיון",
        "נוצר: 2026-05-24T10:00:00.000Z",
        "עודכן: 2026-05-24T10:01:00.000Z",
        "",
        "תוכן:",
        "לבנות כפתור ייצוא"
      ].join("\n")
    );
  });

  it("exports untitled notes without using transcript as the title", () => {
    expect(
      getExportedNotesText(
        [
          {
            createdAt: "2026-05-24T10:00:00.000Z",
            type: "thought",
            transcript: "התמלול הזה לא אמור להפוך לכותרת"
          }
        ],
        "2026-05-24T10:02:00.000Z"
      )
    ).toContain("1. ללא שם\nסוג: מחשבה");
  });
});
