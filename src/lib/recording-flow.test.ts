import { describe, expect, it } from "vitest";
import {
  getResetRecordingDraftState,
  formatRecordingDuration,
  getRecordingPrimaryAction,
  getRecordingStatusLabel
} from "./recording-flow";

describe("recording flow labels", () => {
  it("shows pause/resume actions for one continuous recording", () => {
    expect(getRecordingPrimaryAction("idle")).toEqual({
      label: "התחל הקלטה",
      action: "start"
    });
    expect(getRecordingPrimaryAction("recording")).toEqual({
      label: "השהה",
      action: "pause"
    });
    expect(getRecordingPrimaryAction("paused")).toEqual({
      label: "המשך",
      action: "resume"
    });
  });

  it("labels paused recording separately from finished transcript states", () => {
    expect(getRecordingStatusLabel("paused")).toBe("מושהה");
    expect(getRecordingStatusLabel("transcribing")).toBe("מתמלל");
  });

  it("formats elapsed recording time", () => {
    expect(formatRecordingDuration(0)).toBe("00:00");
    expect(formatRecordingDuration(75)).toBe("01:15");
    expect(formatRecordingDuration(3670)).toBe("61:10");
  });

  it("resets saved recording draft state back to a fresh recording", () => {
    expect(getResetRecordingDraftState()).toEqual({
      transcript: "",
      title: "",
      tags: "",
      type: "thought",
      elapsedSeconds: 0
    });
  });

  it("starts a new recording timer from zero", () => {
    expect(getResetRecordingDraftState().elapsedSeconds).toBe(0);
  });
});
