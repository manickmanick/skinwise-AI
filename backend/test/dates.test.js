import test from "node:test";
import assert from "node:assert/strict";
import {
  localDateFor,
  qualifiesDay,
  summarizeStreak,
} from "../src/utils/dates.js";

test("50 percent qualifies and less than 50 percent does not", () => {
  assert.equal(qualifiesDay(2, 4), true);
  assert.equal(qualifiesDay(1, 4), false);
  assert.equal(qualifiesDay(0, 0), false);
});

test("streak starts on the first qualifying day and counts consecutive days", () => {
  assert.deepEqual(summarizeStreak(["2026-10-27"], "2026-10-27"), {
    currentStreak: 1,
    bestStreak: 1,
    todayQualifies: true,
  });
  assert.deepEqual(
    summarizeStreak(["2026-10-25", "2026-10-26", "2026-10-27"], "2026-10-27"),
    { currentStreak: 3, bestStreak: 3, todayQualifies: true },
  );
});

test("a missed day breaks the streak, while yesterday remains current until today is assessed", () => {
  assert.deepEqual(
    summarizeStreak(["2026-10-24", "2026-10-26"], "2026-10-27"),
    { currentStreak: 1, bestStreak: 1, todayQualifies: false },
  );
  assert.deepEqual(summarizeStreak(["2026-10-24"], "2026-10-27"), {
    currentStreak: 0,
    bestStreak: 1,
    todayQualifies: false,
  });
});

test("local day follows the saved IANA timezone", () => {
  assert.equal(
    localDateFor("Asia/Kolkata", new Date("2026-10-26T20:00:00Z")),
    "2026-10-27",
  );
});
