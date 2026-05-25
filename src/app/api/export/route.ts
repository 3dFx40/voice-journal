import { NextResponse } from "next/server";
import { getExportedNotesText } from "@/lib/note-display";
import { listNotes } from "@/lib/notes";

export const runtime = "nodejs";

export async function GET() {
  const notes = await listNotes();
  const exportedAt = new Date().toISOString();
  const body = `\ufeff${getExportedNotesText(notes, exportedAt)}`;
  const filename = `personal-notebook-${exportedAt.slice(0, 10)}.txt`;

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
