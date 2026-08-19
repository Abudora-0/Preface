import { describe, expect, it } from "vitest";
import { aiOffered } from "./ai";

describe("aiOffered", () => {
  it("offers generation by default, so a local checkout needs no configuration", () => {
    expect(aiOffered({})).toBe(true);
  });

  it("hides generation when a deployment opts out", () => {
    expect(aiOffered({ PREFACE_DISABLE_AI: "1" })).toBe(false);
    expect(aiOffered({ PREFACE_DISABLE_AI: "true" })).toBe(false);
    expect(aiOffered({ PREFACE_DISABLE_AI: " TRUE " })).toBe(false);
  });

  it("treats an empty or unset value as not opting out", () => {
    // .env files routinely carry a declared-but-blank key.
    expect(aiOffered({ PREFACE_DISABLE_AI: "" })).toBe(true);
    expect(aiOffered({ PREFACE_DISABLE_AI: "   " })).toBe(true);
    expect(aiOffered({ PREFACE_DISABLE_AI: "0" })).toBe(true);
    expect(aiOffered({ PREFACE_DISABLE_AI: "false" })).toBe(true);
  });

  it("is independent of which provider is configured", () => {
    expect(aiOffered({ PREFACE_DISABLE_AI: "1", AI_PROVIDER: "anthropic" })).toBe(false);
    expect(aiOffered({ AI_PROVIDER: "anthropic" })).toBe(true);
  });
});
