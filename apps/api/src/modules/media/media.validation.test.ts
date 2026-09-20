import { describe, expect, it } from "vitest";
import { assertFileMatchesMimeType } from "./media.validation";

describe("uploaded file signatures", () => {
  it.each([
    ["application/pdf", Buffer.from("%PDF-1.7\n")],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xdb])],
    [
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ["image/webp", Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ")],
  ])("accepts a %s file with a matching signature", (mimeType, buffer) => {
    expect(() => assertFileMatchesMimeType(mimeType, buffer)).not.toThrow();
  });

  it("rejects a declared PDF whose bytes are not a PDF", () => {
    expect(() =>
      assertFileMatchesMimeType("application/pdf", Buffer.from("not a PDF")),
    ).toThrow(/signature/i);
  });

  it("rejects empty uploads", () => {
    expect(() =>
      assertFileMatchesMimeType("image/png", Buffer.alloc(0)),
    ).toThrow(/empty/i);
  });
});
