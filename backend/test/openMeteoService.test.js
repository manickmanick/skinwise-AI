import test from "node:test";
import assert from "node:assert/strict";
import { getUvForecast } from "../src/integrations/weather/openMeteoService.js";

test("resolves a city and returns only a real provider UV value", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(new URL(String(url)));
    if (calls.length === 1) {
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              name: "Bengaluru",
              country: "India",
              latitude: 12.97,
              longitude: 77.59,
              timezone: "Asia/Kolkata",
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        timezone: "Asia/Kolkata",
        daily: { time: ["2026-10-27"], uv_index_max: [6.2] },
      }),
    };
  });
  const result = await getUvForecast({ city: "Bengaluru" });
  assert.equal(result.available, true);
  assert.equal(result.uvIndex, 6.2);
  assert.equal(result.city, "Bengaluru");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].searchParams.get("daily"), "uv_index_max");
});

test("returns an unavailable state instead of inventing a UV number", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ results: [] }),
  }));
  const result = await getUvForecast({ city: "No Such City" });
  assert.equal(result.available, false);
  assert.equal(result.uvIndex, undefined);
});
