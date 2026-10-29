import assert from "node:assert/strict";
import { after, test } from "node:test";
import { getYouCamConfig } from "../src/config/youcam.js";
import { startSkinAnalysis } from "../src/services/skinAnalysis/skinAnalysisService.js";

const originalApiKey = process.env.YOUCAM_API_KEY;
const originalFetch = globalThis.fetch;
process.env.YOUCAM_API_KEY = "test-youcam-key";

after(() => {
  if (originalApiKey === undefined) delete process.env.YOUCAM_API_KEY;
  else process.env.YOUCAM_API_KEY = originalApiKey;
  globalThis.fetch = originalFetch;
});

test("MVC analysis service parses the documented YouCam file response", async () => {
  assert.equal(
    getYouCamConfig().fileEndpoint,
    "https://yce-api-01.makeupar.com/s2s/v2.0/file",
  );

  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).endsWith("/s2s/v2.0/file")) {
      return Response.json({
        status: 200,
        data: {
          files: [
            {
              file_id: "provider-file-1",
              requests: [
                {
                  method: "PUT",
                  url: "https://yce-us.s3-accelerate.amazonaws.com/signed-upload",
                  headers: { "Content-Type": "image/jpeg" },
                },
              ],
            },
          ],
        },
      });
    }

    if (String(url).includes("s3-accelerate.amazonaws.com")) {
      return new Response(null, { status: 200 });
    }

    if (String(url).endsWith("/s2s/v2.1/task/skin-analysis")) {
      return Response.json({
        status: 200,
        data: { task_id: "provider-task-1" },
      });
    }

    throw new Error(`Unexpected YouCam request: ${url}`);
  };

  const result = await startSkinAnalysis(
    {
      buffer: Buffer.from("test-image-bytes"),
    },
    { format: "jpeg", mimeType: "image/jpeg", width: 640, height: 480 },
  );

  assert.equal(result.providerTaskId, "provider-task-1");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer test-youcam-key",
  );
  assert.equal(calls[1].options.method, "PUT");
  assert.equal(calls[1].options.body.toString(), "test-image-bytes");
  assert.equal(calls[2].options.method, "POST");
  assert.equal(
    JSON.parse(calls[2].options.body).src_file_id,
    "provider-file-1",
  );
});
