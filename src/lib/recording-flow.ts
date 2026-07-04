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
    type: "thought" as const,
    elapsedSeconds: 0
  };
}

export function getMicrophoneErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "הדפדפן חוסם מיקרופון כי האתר לא נפתח בחיבור מאובטח. פתח את כתובת ה-HTTPS של Vercel.";
  }

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "הרשאת המיקרופון חסומה. לחץ על סמל המנעול ליד הכתובת ואפשר Microphone.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "לא נמצא מיקרופון מחובר או זמין במחשב.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "המיקרופון תפוס על ידי אפליקציה אחרת או שהדפדפן לא מצליח לגשת אליו.";
  }

  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return "הדפדפן הזה לא תומך בהקלטה ישירה. פתח את האתר ב-Chrome או Edge.";
  }

  if (typeof MediaRecorder === "undefined") {
    return "הדפדפן הזה לא תומך ב-MediaRecorder. פתח את האתר ב-Chrome או Edge.";
  }

  return "לא הצלחתי לפתוח את המיקרופון. בדוק הרשאות בדפדפן.";
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
