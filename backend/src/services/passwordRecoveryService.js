import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { pool } from "../config/database.js";
import { hashPassword } from "./passwordHash.js";

const OTP_TTL_MS = 120_000;
const RESET_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = Number(process.env.RECOVERY_OTP_MAX_ATTEMPTS) || 5;
const RESEND_COOLDOWN_MS =
  Number(process.env.RECOVERY_RESEND_COOLDOWN_MS) || 60_000;
const OTP_SECRET = process.env.OTP_HASH_SECRET;

function digest(value) {
  if (!OTP_SECRET || Buffer.byteLength(OTP_SECRET, "utf8") < 32) {
    const error = new Error(
      "OTP_HASH_SECRET must contain at least 32 characters.",
    );
    error.code = "OTP_CONFIG_MISSING";
    throw error;
  }
  return crypto.createHmac("sha256", OTP_SECRET).update(value).digest("hex");
}

function sameDigest(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b || "", "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function mailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } =
    process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
    const error = new Error("SMTP delivery is not configured.");
    error.code = "SMTP_CONFIG_MISSING";
    throw error;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.NODE_ENV === "production",
    auth:
      SMTP_USER && SMTP_PASSWORD
        ? { user: SMTP_USER, pass: SMTP_PASSWORD }
        : undefined,
  });
}

function assertRecoveryConfigured() {
  if (!OTP_SECRET || Buffer.byteLength(OTP_SECRET, "utf8") < 32) {
    const error = new Error("Password recovery is not configured.");
    error.code = "OTP_CONFIG_MISSING";
    error.statusCode = 503;
    throw error;
  }
  if (
    !process.env.SMTP_HOST ||
    !Number.isInteger(Number(process.env.SMTP_PORT)) ||
    Number(process.env.SMTP_PORT) < 1 ||
    Number(process.env.SMTP_PORT) > 65535 ||
    !process.env.SMTP_FROM
  ) {
    const error = new Error(
      "Password recovery email is temporarily unavailable.",
    );
    error.code = "SMTP_CONFIG_MISSING";
    error.statusCode = 503;
    throw error;
  }
}

export async function requestPasswordOtp(email) {
  assertRecoveryConfigured();
  await pool.execute("DELETE FROM password_reset_otps WHERE expires_at < ?", [
    Date.now() - 24 * 60 * 60_000,
  ]);
  const [users] = await pool.execute(
    "SELECT id, email FROM users WHERE email = ?",
    [email],
  );
  if (!users.length)
    return {
      accepted: true,
      challengeId: crypto.randomUUID(),
      expiresAt: Date.now() + OTP_TTL_MS,
    };
  const user = users[0];
  const now = Date.now();
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challengeId = crypto.randomUUID();
  const expiresAt = now + OTP_TTL_MS;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [
      user.id,
    ]);
    const [[recent]] = await connection.execute(
      "SELECT COUNT(*) AS sent, MAX(last_sent_at) AS last_sent FROM password_reset_otps WHERE user_id = ? AND last_sent_at > ?",
      [
        user.id,
        now - (Number(process.env.RECOVERY_EMAIL_WINDOW_MS) || 60 * 60_000),
      ],
    );
    if (
      Number(recent.sent) >= (Number(process.env.RECOVERY_EMAIL_LIMIT) || 5) ||
      (recent.last_sent && now - Number(recent.last_sent) < RESEND_COOLDOWN_MS)
    ) {
      const error = new Error("Please wait before requesting another code.");
      error.statusCode = 429;
      error.code = "OTP_RATE_LIMITED";
      throw error;
    }
    await connection.execute(
      "UPDATE password_reset_otps SET otp_hash = NULL, reset_token_hash = NULL, used_at = COALESCE(used_at, ?) WHERE user_id = ? AND used_at IS NULL",
      [now, user.id],
    );
    await connection.execute(
      "INSERT INTO password_reset_otps (id, user_id, purpose, otp_hash, expires_at, attempts, last_sent_at) VALUES (?, ?, 'password_reset', ?, ?, 0, ?)",
      [challengeId, user.id, digest(`${challengeId}:${otp}`), expiresAt, now],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    await mailer().sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "Your SkinWise password reset code",
      text: `Your verification code is ${otp}. It expires in two minutes. If you did not request this, you can ignore this email.`,
    });
  } catch (cause) {
    await pool.execute(
      "UPDATE password_reset_otps SET otp_hash = NULL, used_at = ? WHERE id = ?",
      [Date.now(), challengeId],
    );
    console.error(
      JSON.stringify({
        level: "error",
        message: "Password reset email delivery failed",
        error: cause.code || cause.name || "MailDeliveryError",
      }),
    );
    const error = new Error(
      "We couldn't process your recovery request right now. Please try again later.",
    );
    error.statusCode = 503;
    error.code = "MAIL_DELIVERY_FAILED";
    throw error;
  }
  return { accepted: true, challengeId, expiresAt };
}

export async function verifyPasswordOtp(challengeId, otp) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.execute(
      "SELECT * FROM password_reset_otps WHERE id = ? AND purpose = 'password_reset' FOR UPDATE",
      [challengeId],
    );
    const now = Date.now();
    if (!row || row.used_at || row.verified_at || !row.otp_hash) {
      await connection.rollback();
      return { error: "invalid" };
    }
    if (Number(row.expires_at) <= now) {
      await connection.execute(
        "UPDATE password_reset_otps SET otp_hash = NULL, used_at = ? WHERE id = ?",
        [now, challengeId],
      );
      await connection.commit();
      return { error: "expired" };
    }
    if (Number(row.attempts) >= MAX_ATTEMPTS) {
      await connection.execute(
        "UPDATE password_reset_otps SET otp_hash = NULL, used_at = ? WHERE id = ?",
        [now, challengeId],
      );
      await connection.commit();
      return { error: "invalid" };
    }
    if (!sameDigest(digest(`${challengeId}:${otp}`), row.otp_hash)) {
      const attempts = Number(row.attempts) + 1;
      await connection.execute(
        "UPDATE password_reset_otps SET attempts = ?, otp_hash = IF(? >= ?, NULL, otp_hash), used_at = IF(? >= ?, ?, used_at) WHERE id = ?",
        [
          attempts,
          attempts,
          MAX_ATTEMPTS,
          attempts,
          MAX_ATTEMPTS,
          now,
          challengeId,
        ],
      );
      await connection.commit();
      return { error: attempts >= MAX_ATTEMPTS ? "locked" : "invalid" };
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    await connection.execute(
      "UPDATE password_reset_otps SET otp_hash = NULL, verified_at = ?, reset_token_hash = ?, reset_expires_at = ? WHERE id = ?",
      [now, digest(`reset:${resetToken}`), now + RESET_TTL_MS, challengeId],
    );
    await connection.commit();
    return { resetToken, expiresAt: now + RESET_TTL_MS };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function completePasswordReset(resetToken, password, bcrypt) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.execute(
      "SELECT id, user_id FROM password_reset_otps WHERE reset_token_hash = ? AND purpose = 'password_reset' AND verified_at IS NOT NULL AND used_at IS NULL AND reset_expires_at > ? FOR UPDATE",
      [digest(`reset:${resetToken}`), Date.now()],
    );
    if (!row) {
      await connection.rollback();
      return false;
    }
    const passwordHash = await hashPassword(password, bcrypt);
    const now = Date.now();
    await connection.execute(
      "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [passwordHash, row.user_id],
    );
    await connection.execute(
      "UPDATE password_reset_otps SET used_at = ?, reset_token_hash = NULL WHERE user_id = ? AND used_at IS NULL",
      [now, row.user_id],
    );
    await connection.execute("DELETE FROM sessions WHERE data LIKE ?", [
      `%\"userId\":\"${row.user_id}\"%`,
    ]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
