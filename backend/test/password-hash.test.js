import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "../src/services/passwordHash.js";

test("versioned bcrypt hashes support long passwords and legacy bcrypt hashes remain valid", async () => {
  const newPassword = "long secure passphrase ".repeat(5).slice(0, 120);
  const stored = await hashPassword(newPassword, bcrypt);
  assert.equal(await verifyPassword(newPassword, stored, bcrypt), true);
  assert.equal(await verifyPassword(`${newPassword}x`, stored, bcrypt), false);
  const legacy = await bcrypt.hash("legacy-password", 4);
  assert.equal(await verifyPassword("legacy-password", legacy, bcrypt), true);
});
