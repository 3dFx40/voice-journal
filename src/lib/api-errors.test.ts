import { describe, expect, it } from "vitest";
import { getApiErrorMessage, getSaveNoteErrorMessage } from "./api-errors";

describe("api error helpers", () => {
  it("reads the server error from a failed JSON response", async () => {
    const response = new Response(
      JSON.stringify({ error: "Supabase request failed (401): permission denied" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );

    await expect(getApiErrorMessage(response, "fallback")).resolves.toBe(
      "Supabase request failed (401): permission denied"
    );
  });

  it("falls back when the failed response has no readable error", async () => {
    const response = new Response("not json", { status: 500 });

    await expect(getApiErrorMessage(response, "fallback")).resolves.toBe("fallback");
  });

  it("maps known save failures to user-visible Hebrew messages", () => {
    expect(getSaveNoteErrorMessage(new Error("Transcript is required"))).toBe(
      "צריך תמלול לפני שמירה."
    );
    expect(
      getSaveNoteErrorMessage(
        new Error("Supabase request failed (400): column title does not exist")
      )
    ).toBe(
      "שמירת הפתק נכשלה במסד הנתונים: Supabase request failed (400): column title does not exist"
    );
    expect(
      getSaveNoteErrorMessage(
        new Error("Production storage requires Supabase configuration")
      )
    ).toBe("שמירת הפתק נכשלה: חסרה הגדרת Supabase בסביבת השרת.");
  });
});
