import test from "node:test";
import assert from "node:assert/strict";
import { generateRoutine } from "../src/services/routineEngine.js";

test("routine is deterministic and creates ordered morning/night essentials", () => {
  const profile = {
    skin_type: "dry",
    concerns: ["dryness"],
    allergies: [],
    sensitivity: "unsure",
  };
  const first = generateRoutine(profile, []);
  const second = generateRoutine(profile, []);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.steps.map((step) => step.period),
    ["morning", "morning", "morning", "night", "night"],
  );
  assert.equal(first.steps[2].title, "Broad-spectrum sunscreen");
  assert.match(first.steps[1].reason, /self-reported dryness/);
});

test("routine avoids aggressive actives and includes declared allergen cautions", () => {
  const routine = generateRoutine(
    {
      skin_type: "unsure",
      concerns: ["acne"],
      allergies: ["fragrance"],
      sensitivity: "often",
    },
    [{ type: "acne", ui_score: 100 }],
  );
  assert.equal(routine.steps.length, 5);
  assert.ok(routine.steps.every((step) => step.caution?.includes("fragrance")));
  assert.ok(
    routine.steps.every((step) => !/retinoid|acid|benzoyl/i.test(step.title)),
  );
});

test("missing profile information produces a safe basic routine", () => {
  const routine = generateRoutine(null, []);
  assert.equal(routine.steps.length, 5);
  assert.equal(routine.steps[0].title, "Gentle cleanser");
});
