export async function getApiErrorMessage(response: Response, fallback: string) {
  const body = await readJsonBody(response);
  const message = typeof body?.error === "string" ? body.error.trim() : "";

  return message || fallback;
}

async function readJsonBody(response: Response) {
  try {
    return (await response.json()) as { error?: unknown } | null;
  } catch {
    return null;
  }
}

export function getSaveNoteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "Transcript is required") {
    return "צריך תמלול לפני שמירה.";
  }

  if (message === "Invalid note type") {
    return "סוג הפתק לא תקין.";
  }

  if (message.includes("Supabase storage requires")) {
    return "שמירת הפתק נכשלה: הגדרת האחסון בשרת חסרה.";
  }

  if (message.includes("Production storage requires Supabase configuration")) {
    return "שמירת הפתק נכשלה: חסרה הגדרת Supabase בסביבת השרת.";
  }

  if (message.includes("Supabase request failed")) {
    return `שמירת הפתק נכשלה במסד הנתונים: ${message}`;
  }

  if (message.toLowerCase().includes("fetch")) {
    return "שמירת הפתק נכשלה בגלל בעיית רשת או שרת.";
  }

  return message ? `שמירת הפתק נכשלה: ${message}` : "שמירת הפתק נכשלה.";
}
