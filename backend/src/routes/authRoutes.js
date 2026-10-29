import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { pool } from "../config/database.js";
import { validate } from "../middleware/validate.js";
import {
  completePasswordReset,
  requestPasswordOtp,
  verifyPasswordOtp,
} from "../services/passwordRecoveryService.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../validators/authSchemas.js";
import { hashPassword, verifyPassword } from "../services/passwordHash.js";

const router = Router();
const DUMMY_PASSWORD_HASH = await bcrypt.hash(
  "not-a-real-account-password",
  12,
);
const publicUser = (row) => ({ id: row.id, email: row.email });
const regenerateSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
const recoveryLimiter = rateLimit({
  windowMs: Number(process.env.RECOVERY_IP_WINDOW_MS) || 15 * 60 * 1000,
  limit: Number(process.env.RECOVERY_IP_LIMIT) || 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many recovery attempts. Wait a little and try again.",
      code: "RATE_LIMITED",
    }),
});
const recoveryEmailLimiter = rateLimit({
  windowMs: Number(process.env.RECOVERY_EMAIL_WINDOW_MS) || 60 * 60 * 1000,
  limit: Number(process.env.RECOVERY_EMAIL_LIMIT) || 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) =>
    crypto.createHash("sha256").update(req.body.email).digest("hex"),
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many recovery requests. Please wait and try again.",
      code: "RATE_LIMITED",
    }),
});

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  recoveryEmailLimiter,
  recoveryLimiter,
  async (req, res) => {
    const recovery = await requestPasswordOtp(req.body.email);
    res.status(202).json({
      success: true,
      message:
        "If an eligible account exists, we'll send a verification code shortly.",
      challengeId: recovery.challengeId,
      expiresAt: recovery.expiresAt,
    });
  },
);

router.post(
  "/verify-reset-otp",
  recoveryLimiter,
  validate(verifyOtpSchema),
  async (req, res) => {
    const verification = await verifyPasswordOtp(
      req.body.challengeId,
      req.body.otp,
    );
    if (verification.error) {
      const expired = verification.error === "expired";
      return res.status(expired ? 410 : 400).json({
        success: false,
        message: expired
          ? "This code has expired. Request a new one."
          : "The code is incorrect or no longer valid. Please try again.",
        errors: {
          otp: expired
            ? "This code has expired. Request a new one."
            : "The code is incorrect or no longer valid.",
        },
        code: expired
          ? "OTP_EXPIRED"
          : verification.error === "locked"
            ? "OTP_ATTEMPTS_EXCEEDED"
            : "OTP_INVALID",
      });
    }
    res.json({
      success: true,
      resetToken: verification.resetToken,
      expiresAt: verification.expiresAt,
    });
  },
);

router.post(
  "/reset-password",
  recoveryLimiter,
  validate(resetPasswordSchema),
  async (req, res) => {
    const changed = await completePasswordReset(
      req.body.resetToken,
      req.body.password,
      bcrypt,
    );
    if (!changed)
      return res.status(400).json({
        success: false,
        message:
          "This reset link has expired or was already used. Request a new code.",
        code: "RESET_AUTH_INVALID",
      });
    res.json({
      success: true,
      message: "Your password has been updated. You can sign in now.",
    });
  },
);

router.get("/me", async (req, res) => {
  if (!req.session.userId) return res.json({ success: true, user: null });
  const [rows] = await pool.execute(
    "SELECT id, email FROM users WHERE id = ?",
    [req.session.userId],
  );
  if (!rows.length) return res.json({ success: true, user: null });
  res.json({ success: true, user: publicUser(rows[0]) });
});

router.post("/register", validate(registerSchema), async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body?.password;
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.trim().length === 0 ||
    password.length < 10 ||
    password.length > 128
  ) {
    return res.status(400).json({
      success: false,
      status: "error",
      message:
        "Enter a valid email and a password between 10 and 128 characters.",
      code: "VALIDATION_ERROR",
    });
  }
  const id = crypto.randomUUID();
  const hash = await hashPassword(password, bcrypt);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [id, email, hash],
    );
    const timezone = req.body?.timezone;
    const safeTimezone =
      typeof timezone === "string" && isValidTimeZone(timezone)
        ? timezone
        : "UTC";
    await connection.execute(
      "INSERT INTO user_preferences (user_id, timezone) VALUES (?, ?)",
      [id, safeTimezone],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY")
      return res.status(409).json({
        success: false,
        status: "error",
        message:
          "Unable to create this account. Check your details or sign in.",
        code: "ACCOUNT_EXISTS",
      });
    throw error;
  } finally {
    connection.release();
  }
  await regenerateSession(req);
  req.session.userId = id;
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  await saveSession(req);
  res.status(201).json({ success: true, user: { id, email } });
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const [rows] = await pool.execute(
    "SELECT id, email, password_hash FROM users WHERE email = ?",
    [email],
  );
  const row = rows[0];
  const valid = row
    ? await verifyPassword(password, row.password_hash, bcrypt)
    : await bcrypt.compare(password || "invalid-password", DUMMY_PASSWORD_HASH);
  if (!row || !valid)
    return res.status(401).json({
      success: false,
      status: "error",
      message: "Email or password is incorrect.",
      code: "AUTH_INVALID",
    });
  await regenerateSession(req);
  req.session.userId = row.id;
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  await saveSession(req);
  res.json({ success: true, user: publicUser(row) });
});

router.post("/logout", async (req, res) => {
  if (!req.session) return res.status(204).end();
  await new Promise((resolve) => req.session.destroy(() => resolve()));
  res.clearCookie("skinwise.sid", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.status(204).end();
});

router.delete("/account", async (req, res) => {
  if (!req.session.userId)
    return res
      .status(401)
      .json({ status: "error", message: "Please sign in to continue." });
  const userId = req.session.userId;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM sessions WHERE data LIKE ?", [
      `%\"userId\":\"${userId}\"%`,
    ]);
    await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  await new Promise((resolve) => req.session.destroy(() => resolve()));
  res.clearCookie("skinwise.sid", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.status(204).end();
});

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export default router;
