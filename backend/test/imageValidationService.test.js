import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { validateSkinAnalysisImage } from "../src/services/imageValidationService.js";

test("authoritatively rejects missing, invalid, oversized and too-small images", async () => {
  await assert.rejects(validateSkinAnalysisImage(null), { statusCode: 400 });
  await assert.rejects(
    validateSkinAnalysisImage({
      buffer: Buffer.from("not an image"),
      size: 12,
    }),
    /not a valid image/,
  );
  await assert.rejects(
    validateSkinAnalysisImage({
      buffer: Buffer.alloc(1),
      size: 10 * 1024 * 1024 + 1,
    }),
    /10 MB or less/,
  );
  const small = await sharp({
    create: { width: 479, height: 600, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  await assert.rejects(
    validateSkinAnalysisImage({ buffer: small, size: small.length }),
    /shortest side must be at least 480/,
  );
});

test("accepts JPEG and PNG image content at the supported minimum dimensions", async () => {
  for (const format of ["jpeg", "png"]) {
    const buffer = await sharp({
      create: { width: 480, height: 640, channels: 3, background: "white" },
    })
      .toFormat(format)
      .toBuffer();
    const result = await validateSkinAnalysisImage({
      buffer,
      size: buffer.length,
    });
    assert.equal(result.width, 480);
    assert.equal(result.height, 640);
    assert.equal(result.format, format);
  }
});
