import { describe, expect, it } from "vitest";
import { validateImageFile } from "./imageValidation";

describe("validateImageFile", () => {
  it("accepts a JPEG within the supported size", () => {
    expect(
      validateImageFile(
        new File([new Uint8Array(10)], "face.jpg", { type: "image/jpeg" }),
      ),
    ).toBeNull();
  });
  it("rejects unsupported types, empty files and files over 10 MB", () => {
    expect(
      validateImageFile(new File(["x"], "face.gif", { type: "image/gif" })),
    ).toMatch(/JPEG or PNG/);
    expect(
      validateImageFile(new File([], "empty.png", { type: "image/png" })),
    ).toMatch(/empty/);
    expect(
      validateImageFile(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {
          type: "image/png",
        }),
      ),
    ).toMatch(/10 MB/);
  });
});
