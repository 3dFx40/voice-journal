import { NextRequest, NextResponse } from "next/server";
import { createNote, isNoteType, listNotes } from "@/lib/notes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") ?? "all";
  const search = searchParams.get("search") ?? "";

  if (type !== "all" && !isNoteType(type)) {
    return NextResponse.json({ error: "Invalid note type" }, { status: 400 });
  }

  const notes = await listNotes({ search, type });
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!isNoteType(body.type)) {
    return NextResponse.json({ error: "Invalid note type" }, { status: 400 });
  }

  try {
    const note = await createNote({
      type: body.type,
      transcript: String(body.transcript ?? ""),
      title: optionalString(body.title),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : parseTags(body.tags)
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save note";
    console.error("Create note failed:", {
      error: message,
      type: body.type,
      hasTranscript: typeof body.transcript === "string" && body.transcript.trim().length > 0,
      hasTitle: typeof body.title === "string" && body.title.trim().length > 0,
      tagCount: Array.isArray(body.tags) ? body.tags.length : 0
    });

    return NextResponse.json(
      { error: message },
      { status: getCreateNoteErrorStatus(message) }
    );
  }
}

function getCreateNoteErrorStatus(message: string) {
  if (message === "Invalid note type" || message === "Transcript is required") {
    return 400;
  }

  return 500;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function parseTags(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
