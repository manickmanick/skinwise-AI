import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSkinImage } from "../src/services/skinAnalysisService.js";

const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

test("uploads the original image, polls YouCam and returns its actual result object", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-provider-key";
  t.after(() => { if (previousKey === undefined) delete process.env.YOUCAM_API_KEY; else process.env.YOUCAM_API_KEY = previousKey; });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    const target = new URL(String(url));
    calls.push({ url: target, options });
    if (target.pathname.endsWith("/file/skin-analysis")) return jsonResponse({ data: { files: [{ file_id: "file-1", requests: [{ url: "https://uploads.example.test/file-1", method: "PUT", headers: { "Content-Type": "image/jpeg" } }] }] } });
    if (target.hostname === "uploads.example.test") return { ok: true, status: 200, text: async () => "" };
    if (target.pathname.endsWith("/task/skin-analysis")) return jsonResponse({ data: { task_id: "task-1" } });
    return jsonResponse({ data: { task_status: "success", results: { output: [{ type: "acne", ui_score: 62 }, { type: "skin_type", region: "whole", skin_type: "Oily" }] } } });
  });
  const image = Buffer.from("original-image-bytes");
  const result = await analyzeSkinImage({ buffer: image, originalname: "sensitive-name.jpg" }, { width: 480, height: 640, format: "jpeg", mimeType: "image/jpeg" });
  assert.deepEqual(result.results.output, [{ type: "acne", ui_score: 62 }, { type: "skin_type", region: "whole", skin_type: "Oily" }]);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-only-provider-key");
  assert.match(JSON.parse(calls[0].options.body).files[0].file_name, /^skinwise-[0-9a-f-]+\.jpg$/i);
  assert.deepEqual(calls[1].options.body, image);
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test("maps provider throttling to a retryable service-unavailable response", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-provider-key";
  t.after(() => { if (previousKey === undefined) delete process.env.YOUCAM_API_KEY; else process.env.YOUCAM_API_KEY = previousKey; });
  t.mock.method(globalThis, "fetch", async () => jsonResponse({ message: "private provider detail" }, 429));
  await assert.rejects(analyzeSkinImage({ buffer: Buffer.from("image") }, { width: 480, height: 480, format: "jpeg", mimeType: "image/jpeg" }), (error) => error.statusCode === 503 && !error.message.includes("private provider detail"));
});
