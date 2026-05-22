import { describe, expect, it } from "vitest";
import {
  getCopyableNoteText,
  getNoteListTitle,
  shouldShowTranscriptPreview
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

  it("shows transcript previews only for journal and reminder notes", () => {
    expect(shouldShowTranscriptPreview("journal")).toBe(true);
    expect(shouldShowTranscriptPreview("reminder")).toBe(true);
    expect(shouldShowTranscriptPreview("dream")).toBe(false);
    expect(shouldShowTranscriptPreview("idea")).toBe(false);
    expect(shouldShowTranscriptPreview("thought")).toBe(false);
    expect(shouldShowTranscriptPreview("other")).toBe(false);
  });

  it("copies title, type, tags and full transcript", () => {
    expect(
      getCopyableNoteText({
        title: "פגישה עם דנה",
        type: "reminder",
        tags: ["עבודה", "חשוב"],
        transcript: "להתקשר מחר בבוקר"
      })
    ).toBe("פגישה עם דנה\nסוג: תזכורת\nתגיות: עבודה, חשוב\n\nלהתקשר מחר בבוקר");
  });
});
