import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PLACEHOLDER = "replace_with_your_openai_api_key";

export async function getOpenAIAPIKey() {
  const localEnvKey = await readLocalEnvKey();
  return pickOpenAIAPIKey({
    localEnvKey,
    processEnvKey: process.env.OPENAI_API_KEY
  });
}

export function pickOpenAIAPIKey({
  localEnvKey,
  processEnvKey
}: {
  localEnvKey?: string;
  processEnvKey?: string;
}) {
  const local = cleanKey(localEnvKey);
  if (local) {
    return local;
  }

  return cleanKey(processEnvKey);
}

export function readEnvValue(contents: string) {
  const line = contents
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith("OPENAI_API_KEY="));

  if (!line) {
    return undefined;
  }

  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}

async function readLocalEnvKey() {
  try {
    return readEnvValue(await readFile(join(process.cwd(), ".env"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function cleanKey(value?: string) {
  const clean = value?.trim().replace(/^['"]|['"]$/g, "");

  if (!clean || clean === PLACEHOLDER) {
    return undefined;
  }

  return clean;
}
