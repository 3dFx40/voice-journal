import { extname } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { saveAudioUpload } from "@/lib/notes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  const bytes = Buffer.from(await audio.arrayBuffer());
  const extension = safeExtension(audio.name, audio.type);
  const filename = `${crypto.randomUUID()}${extension}`;

  await saveAudioUpload(filename, bytes);

  return NextResponse.json({
    audioPath: `/api/audio/${filename}`
  });
}

function safeExtension(name: string, mimeType: string) {
  const fromName = extname(name).toLowerCase();

  if ([".webm", ".mp3", ".m4a", ".wav", ".ogg"].includes(fromName)) {
    return fromName;
  }

  if (mimeType.includes("wav")) {
    return ".wav";
  }

  if (mimeType.includes("ogg")) {
    return ".ogg";
  }

  return ".webm";
}
