import { describe, expect, it } from "vitest";
import {
  getAllNoteIdsSelected,
  removeNoteIdsFromSelection,
  toggleNoteIdSelection,
  toggleVisibleNoteSelection
} from "./note-selection";

describe("note selection", () => {
  it("toggles a note id in a selected id list", () => {
    expect(toggleNoteIdSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleNoteIdSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("selects or clears all visible notes", () => {
    expect(toggleVisibleNoteSelection([], ["a", "b"])).toEqual(["a", "b"]);
    expect(toggleVisibleNoteSelection(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("keeps unrelated selections when clearing visible notes", () => {
    expect(toggleVisibleNoteSelection(["a", "b", "hidden"], ["a", "b"])).toEqual([
      "hidden"
    ]);
  });

  it("removes deleted notes from selection", () => {
    expect(removeNoteIdsFromSelection(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });

  it("detects whether all visible notes are selected", () => {
    expect(getAllNoteIdsSelected(["a", "b", "c"], ["a", "b"])).toBe(true);
    expect(getAllNoteIdsSelected(["a"], ["a", "b"])).toBe(false);
    expect(getAllNoteIdsSelected(["a"], [])).toBe(false);
  });
});
