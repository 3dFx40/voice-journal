import { describe, expect, it } from "vitest";
import { pickOpenAIAPIKey, readEnvValue } from "./openai-env";

describe("openai env helpers", () => {
  it("prefers a local .env key over an inherited process key", () => {
    expect(
      pickOpenAIAPIKey({
        localEnvKey: "sk-local",
        processEnvKey: "sk-process"
      })
    ).toBe("sk-local");
  });

  it("ignores placeholders and falls back to process env", () => {
    expect(
      pickOpenAIAPIKey({
        localEnvKey: "replace_with_your_openai_api_key",
        processEnvKey: "sk-process"
      })
    ).toBe("sk-process");
  });

  it("reads quoted env values without exposing unrelated lines", () => {
    expect(readEnvValue('OTHER=1\nOPENAI_API_KEY="sk-test"\n')).toBe("sk-test");
  });
});
