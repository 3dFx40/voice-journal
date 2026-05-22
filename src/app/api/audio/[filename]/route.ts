import { basename, extname } from "node:path";
import { NextResponse } from "next/server";
import { readAudioUpload } from "@/lib/notes";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { filename } = await params;
  const safeName = basename(filename);

  if (safeName !== filename) {
    return NextResponse.json({ error: "Invalid audio path" }, { status: 400 });
  }

  const file = await readAudioUpload(safeName);

  if (!file) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  return new NextResponse(file, {
    headers: {
      "Content-Type": contentTypeFor(safeName),
      "Cache-Control": "private, max-age=3600"
    }
  });
}

function contentTypeFor(filename: string) {
  switch (extname(filename).toLowerCase()) {
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    default:
      return "audio/webm";
  }
}
