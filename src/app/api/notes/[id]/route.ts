import { NextRequest, NextResponse } from "next/server";
import { deleteNote, getNote, isNoteType, updateNote } from "@/lib/notes";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const note = await getNote(id);

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ note });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (body.type !== undefined && !isNoteType(body.type)) {
    return NextResponse.json({ error: "Invalid note type" }, { status: 400 });
  }

  try {
    const note = await updateNote(id, {
      type: body.type,
      transcript: body.transcript === undefined ? undefined : String(body.transcript),
      title: optionalString(body.title),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : parseTags(body.tags),
      audioPath: optionalString(body.audioPath),
      keepAudio:
        body.keepAudio === undefined ? undefined : Boolean(body.keepAudio)
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update note" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const deleted = await deleteNote(id);

  if (!deleted) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function parseTags(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
