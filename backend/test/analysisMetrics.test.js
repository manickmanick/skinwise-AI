import test from "node:test";
import assert from "node:assert/strict";
import { normalizedMetrics } from "../src/services/analysisMetrics.js";

test("normalizes supported provider fields and excludes expiring mask URLs", () => {
  const result = normalizedMetrics({
    output: [
      {
        type: "acne",
        ui_score: 64,
        raw_score: 36.5,
        mask_urls: ["https://private.example/signed"],
        url: null,
      },
      { type: "skin_type", region: "whole", skin_type: "Oily" },
      { type: "all", score: 75.1 },
    ],
  });
  assert.deepEqual(result.output, [
    { type: "acne", ui_score: 64, raw_score: 36.5 },
    { type: "skin_type", region: "whole", skin_type: "Oily" },
    { type: "all", score: 75.1 },
  ]);
});
