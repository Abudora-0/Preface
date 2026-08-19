import { describe, expect, it } from "vitest";
import { SPEC_FIELDS, progressFromPartial } from "./ai";

describe("progressFromPartial", () => {
  it("reports nothing done before the model has written a key", () => {
    const p = progressFromPartial("{");
    expect(p.done).toBe(0);
    expect(p.total).toBe(SPEC_FIELDS.length);
  });

  it("advances as each key is written, and names the current field", () => {
    const p = progressFromPartial('{"name":"orbit-api","tagline":"Satellite passes","desc');
    expect(p.done).toBe(2);
    expect(p.field).toBe("the tagline");
  });

  it("counts a key written with spaces around the colon", () => {
    expect(progressFromPartial('{ "name" : "x" }').done).toBe(1);
  });

  it("never advances on a value that merely contains the word", () => {
    // The whole point of requiring the colon: "npm install" is a value.
    const p = progressFromPartial('{"name":"x","tagline":"y","description":"run npm install"}');
    expect(p.done).toBe(3);
    expect(p.field).toBe("the description");
  });

  it("is not fooled by a key name reused inside a nested object", () => {
    // scripts[].name would double count a naive substring check.
    const partial = '{"name":"x","scripts":[{"name":"dev","cmd":"vite"}]';
    const p = progressFromPartial(partial);
    expect(p.done).toBe(2);
  });

  it("reaches the total once the whole object is written", () => {
    const full = `{${SPEC_FIELDS.map((f) => `"${f.key}":null`).join(",")}}`;
    const p = progressFromPartial(full);
    expect(p.done).toBe(SPEC_FIELDS.length);
    expect(p.field).toBe(SPEC_FIELDS[SPEC_FIELDS.length - 1].label);
  });

  it("only moves forward as more text arrives", () => {
    const full = '{"name":"x","tagline":"y","description":"z","features":[]}';
    let last = 0;
    for (let i = 1; i <= full.length; i++) {
      const done = progressFromPartial(full.slice(0, i)).done;
      expect(done).toBeGreaterThanOrEqual(last);
      last = done;
    }
    expect(last).toBe(4);
  });

  it("lists every schema field exactly once, in schema order", () => {
    const keys = SPEC_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe("name");
    expect(keys).toContain("license");
  });
});
