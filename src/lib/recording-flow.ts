export type RecordingStatus =
  | "idle"
  | "recording"
  | "paused"
  | "transcribing"
  | "ready"
  | "saving";

export type RecordingPrimaryAction = "start" | "pause" | "resume";

export function getResetRecordingDraftState() {
  return {
    transcript: "",
    title: "",
    tags: "",
    type: "thought" as const,
    elapsedSeconds: 0
  };
}

export function getRecordingPrimaryAction(status: RecordingStatus): {
  label: string;
  action: RecordingPrimaryAction;
} {
  if (status === "recording") {
    return { label: "השהה", action: "pause" };
  }

  if (status === "paused") {
    return { label: "המשך", action: "resume" };
  }

  return { label: "התחל הקלטה", action: "start" };
}

export function getRecordingStatusLabel(status: RecordingStatus) {
  switch (status) {
    case "recording":
      return "מקליט";
    case "paused":
      return "מושהה";
    case "transcribing":
      return "מתמלל";
    case "saving":
      return "שומר";
    case "ready":
      return "מוכן לעריכה";
    default:
      return "מוכן";
  }
}

export function formatRecordingDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(
    2,
    "0"
  )}`;
}
