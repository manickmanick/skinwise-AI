import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSkinImage } from "../src/services/skinAnalysisService.js";

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

test("uploads the original image, polls YouCam and returns its actual result object", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-provider-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.YOUCAM_API_KEY;
    else process.env.YOUCAM_API_KEY = previousKey;
  });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    const target = new URL(String(url));
    calls.push({ url: target, options });
    if (target.pathname.endsWith("/v2.0/file"))
      return jsonResponse({
        data: {
          files: [
            {
              file_id: "file-1",
              requests: [
                {
                  url: "https://yce-us.s3-accelerate.amazonaws.com/file-1",
                  method: "PUT",
                  headers: { "Content-Type": "image/jpeg" },
                },
              ],
            },
          ],
        },
      });
    if (target.hostname === "yce-us.s3-accelerate.amazonaws.com")
      return { ok: true, status: 200, text: async () => "" };
    if (target.pathname.endsWith("/task/skin-analysis"))
      return jsonResponse({ data: { task_id: "task-1" } });
    return jsonResponse({
      data: {
        task_status: "success",
        results: {
          output: [
            { type: "acne", ui_score: 62 },
            { type: "skin_type", region: "whole", skin_type: "Oily" },
          ],
        },
      },
    });
  });
  const image = Buffer.from("original-image-bytes");
  const result = await analyzeSkinImage(
    { buffer: image, originalname: "sensitive-name.jpg" },
    { width: 480, height: 640, format: "jpeg", mimeType: "image/jpeg" },
  );
  assert.deepEqual(result.results.output, [
    { type: "acne", ui_score: 62 },
    { type: "skin_type", region: "whole", skin_type: "Oily" },
  ]);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].url.pathname, "/s2s/v2.0/file");
  assert.equal(calls[2].url.pathname, "/s2s/v2.1/task/skin-analysis");
  assert.equal(calls[3].url.pathname, "/s2s/v2.1/task/skin-analysis/task-1");
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer test-only-provider-key",
  );
  assert.match(
    JSON.parse(calls[0].options.body).files[0].file_name,
    /^skinwise-[0-9a-f-]+\.jpg$/i,
  );
  assert.deepEqual(calls[1].options.body, image);
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test("reports a signed upload failure with the correct stage and safe status", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-provider-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.YOUCAM_API_KEY;
    else process.env.YOUCAM_API_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async (url) => {
    const target = new URL(String(url));
    if (target.pathname.endsWith("/v2.0/file"))
      return jsonResponse({
        data: {
          files: [
            {
              file_id: "file-1",
              requests: [
                {
                  url: "https://yce-us.s3-accelerate.amazonaws.com/file-1",
                  method: "PUT",
                  headers: {},
                },
              ],
            },
          ],
        },
      });
    return {
      ok: false,
      status: 500,
      text: async () => "private upload response",
    };
  });
  await assert.rejects(
    analyzeSkinImage(
      { buffer: Buffer.from("image") },
      { width: 480, height: 480, format: "jpeg", mimeType: "image/jpeg" },
    ),
    (error) =>
      error.statusCode === 502 &&
      error.code === "YOUCAM_UPLOAD_FAILED" &&
      error.operation === "image_upload" &&
      !error.message.includes("private upload response"),
  );
});

test("maps provider throttling to a retryable service-unavailable response", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-provider-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.YOUCAM_API_KEY;
    else process.env.YOUCAM_API_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({ message: "private provider detail" }, 429),
  );
  await assert.rejects(
    analyzeSkinImage(
      { buffer: Buffer.from("image") },
      { width: 480, height: 480, format: "jpeg", mimeType: "image/jpeg" },
    ),
    (error) =>
      error.statusCode === 503 &&
      !error.message.includes("private provider detail"),
  );
});

test("reports missing YouCam credentials as a configuration issue before making requests", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  delete process.env.YOUCAM_API_KEY;
  t.after(() => {
    if (previousKey !== undefined) process.env.YOUCAM_API_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("fetch should not run");
  });
  await assert.rejects(
    analyzeSkinImage(
      { buffer: Buffer.from("image") },
      { width: 480, height: 480, format: "jpeg", mimeType: "image/jpeg" },
    ),
    (error) =>
      error.statusCode === 503 &&
      error.code === "YOUCAM_NOT_CONFIGURED" &&
      error.message.includes("backend environment"),
  );
});

test("maps a YouCam authentication rejection to a safe configuration error", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-invalid-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.YOUCAM_API_KEY;
    else process.env.YOUCAM_API_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({ error: "private provider detail" }, 401),
  );
  await assert.rejects(
    analyzeSkinImage(
      { buffer: Buffer.from("image") },
      { width: 480, height: 480, format: "jpeg", mimeType: "image/jpeg" },
    ),
    (error) =>
      error.statusCode === 503 &&
      error.code === "YOUCAM_AUTH_FAILED" &&
      error.message.includes("not configured") &&
      !error.message.includes("private provider detail"),
  );
});

test("reports provider request timeouts as gateway timeouts", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-provider-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.YOUCAM_API_KEY;
    else process.env.YOUCAM_API_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async () => {
    const error = new Error("timeout detail");
    error.name = "TimeoutError";
    throw error;
  });
  await assert.rejects(
    analyzeSkinImage(
      { buffer: Buffer.from("image") },
      { width: 480, height: 480, format: "jpeg", mimeType: "image/jpeg" },
    ),
    (error) =>
      error.statusCode === 504 &&
      error.code === "YOUCAM_TIMEOUT" &&
      !error.message.includes("timeout detail"),
  );
});

test("does not expose provider task error details to users", async (t) => {
  const previousKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-only-provider-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.YOUCAM_API_KEY;
    else process.env.YOUCAM_API_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async (url) => {
    const target = new URL(String(url));
    if (target.pathname.endsWith("/v2.0/file"))
      return jsonResponse({
        data: {
          files: [
            {
              file_id: "file-1",
              requests: [
                {
                  url: "https://yce-us.s3-accelerate.amazonaws.com/file-1",
                  method: "PUT",
                  headers: {},
                },
              ],
            },
          ],
        },
      });
    if (target.hostname === "yce-us.s3-accelerate.amazonaws.com")
      return { ok: true, status: 200, text: async () => "" };
    if (target.pathname.endsWith("/task/skin-analysis"))
      return jsonResponse({ data: { task_id: "task-1" } });
    return jsonResponse({
      data: {
        task_status: "error",
        error: "error_src_face_too_small",
        error_message: "sensitive provider detail",
      },
    });
  });
  await assert.rejects(
    analyzeSkinImage(
      { buffer: Buffer.from("image") },
      { width: 480, height: 480, format: "jpeg", mimeType: "image/jpeg" },
    ),
    (error) =>
      error.statusCode === 422 &&
      error.operation === "task_execution" &&
      !error.message.includes("sensitive provider detail"),
  );
});
