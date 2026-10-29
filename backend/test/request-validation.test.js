import test from "node:test";
import assert from "node:assert/strict";
import {
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../src/validators/authSchemas.js";

test("forgot password accepts the account email and rejects malformed input", () => {
  assert.equal(
    forgotPasswordSchema.validate({ email: "USER@example.com" }).error,
    undefined,
  );
  assert.ok(forgotPasswordSchema.validate({ email: "not an email" }).error);
  assert.ok(
    forgotPasswordSchema.validate({
      email: "user@example.com",
      userId: "extra",
    }).error,
  );
});

test("OTP validation requires a UUID challenge and six digits, preserving leading zeroes", () => {
  const valid = {
    challengeId: "550e8400-e29b-41d4-a716-446655440000",
    otp: "004207",
  };
  assert.equal(verifyOtpSchema.validate(valid).error, undefined);
  assert.ok(verifyOtpSchema.validate({ ...valid, otp: "4207" }).error);
  assert.ok(verifyOtpSchema.validate({ ...valid, otp: "12a456" }).error);
});

test("password validation supports long passwords while rejecting whitespace-only values", () => {
  const longPassword = "A".repeat(128);
  assert.equal(
    resetPasswordSchema.validate({
      resetToken: "a".repeat(64),
      password: longPassword,
    }).error,
    undefined,
  );
  assert.ok(
    resetPasswordSchema.validate({
      resetToken: "a".repeat(64),
      password: "          ",
    }).error,
  );
  assert.ok(
    resetPasswordSchema.validate({
      resetToken: "bad",
      password: "a-secure-passphrase",
    }).error,
  );
});

test("login and profile request payloads are bounded and reject unexpected keys", () => {
  assert.equal(
    loginSchema.validate({ email: "person@example.com", password: "anything" })
      .error,
    undefined,
  );
  assert.ok(
    loginSchema.validate({
      email: "person@example.com",
      password: "anything",
      admin: true,
    }).error,
  );
  assert.ok(profileSchema.validate({ skinType: "unsure", extra: "no" }).error);
});
