import { NextRequest, NextResponse } from "next/server";
import { getOpenAIAPIKey } from "@/lib/openai-env";

export const runtime = "nodejs";

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  const apiKey = await getOpenAIAPIKey();

  if (!apiKey) {
    return NextResponse.json({
      mode: "manual",
      transcript: "",
      message:
        "OPENAI_API_KEY לא מוגדר. אפשר להקליד או לערוך את התמלול ידנית ולשמור."
    });
  }

  const outbound = new FormData();
  const audioBlob = new Blob([await audio.arrayBuffer()], {
    type: audio.type || "audio/webm"
  });
  outbound.set("file", audioBlob, safeAudioFilename(audio.name));
  outbound.set(
    "model",
    process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe"
  );
  outbound.set("language", "he");
  outbound.set("response_format", "json");

  const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: outbound
  });

  if (!response.ok) {
    const errorDetails = await readOpenAIError(response);

    return NextResponse.json(
      {
        mode: "manual",
        transcript: "",
        message:
          errorDetails.userMessage ??
          "התמלול האוטומטי נכשל. אפשר להקליד או לערוך את התמלול ידנית ולשמור.",
        details:
          process.env.NODE_ENV === "development"
            ? {
                status: response.status,
                code: errorDetails.code,
                type: errorDetails.type
              }
            : undefined
      },
      { status: 200 }
    );
  }

  const result = (await response.json()) as { text?: string };

  return NextResponse.json({
    mode: "transcribed",
    transcript: result.text ?? "",
    model: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe"
  });
}

function safeAudioFilename(filename: string) {
  const clean = filename.toLowerCase();

  if (clean.endsWith(".wav")) {
    return "recording.wav";
  }

  if (clean.endsWith(".ogg")) {
    return "recording.ogg";
  }

  if (clean.endsWith(".mp3")) {
    return "recording.mp3";
  }

  if (clean.endsWith(".m4a")) {
    return "recording.m4a";
  }

  return "recording.webm";
}

async function readOpenAIError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; type?: string };
    };
    const code = body.error?.code;
    const type = body.error?.type;
    const message = body.error?.message ?? "";

    return {
      code,
      type,
      userMessage: classifyOpenAIError(response.status, code, message)
    };
  } catch {
    return {
      code: undefined,
      type: undefined,
      userMessage: undefined
    };
  }
}

function classifyOpenAIError(status: number, code?: string, message = "") {
  if (status === 401 || code === "invalid_api_key") {
    return "מפתח OpenAI לא תקין או לא נטען. בדוק את OPENAI_API_KEY והפעל מחדש את השרת.";
  }

  if (code === "insufficient_quota" || message.includes("quota")) {
    return "הבקשה הגיעה ל-OpenAI, אבל אין קרדיט/מכסה זמינה בפרויקט ה-API.";
  }

  if (status === 403 || code === "model_not_found") {
    return "המפתח נטען, אבל לפרויקט אין גישה למודל התמלול שהוגדר.";
  }

  if (status === 429) {
    return "הבקשה הגיעה ל-OpenAI, אבל נחסמה זמנית בגלל מגבלת קצב.";
  }

  return undefined;
}
