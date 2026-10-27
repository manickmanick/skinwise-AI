import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "../config/database.js";

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

router.get("/me", async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const [rows] = await pool.execute(
    "SELECT id, email FROM users WHERE id = ?",
    [req.session.userId],
  );
  if (!rows.length) return res.json({ user: null });
  res.json({ user: publicUser(rows[0]) });
});

router.post("/register", async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password = req.body?.password;
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 72
  ) {
    return res
      .status(400)
      .json({
        status: "error",
        message:
          "Enter a valid email and a password between 10 and 72 characters.",
      });
  }
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 12);
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
      return res
        .status(409)
        .json({
          status: "error",
          message:
            "Unable to create this account. Check your details or sign in.",
        });
    throw error;
  } finally {
    connection.release();
  }
  await regenerateSession(req);
  req.session.userId = id;
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  await saveSession(req);
  res.status(201).json({ user: { id, email } });
});

router.post("/login", async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length > 72) {
    await bcrypt.compare("invalid-password", DUMMY_PASSWORD_HASH);
    return res
      .status(401)
      .json({ status: "error", message: "Email or password is incorrect." });
  }
  if (password.length > 72) {
    await bcrypt.compare("invalid-password", DUMMY_PASSWORD_HASH);
    return res
      .status(401)
      .json({ status: "error", message: "Email or password is incorrect." });
  }
  const [rows] = await pool.execute(
    "SELECT id, email, password_hash FROM users WHERE email = ?",
    [email],
  );
  const row = rows[0];
  const valid = row
    ? await bcrypt.compare(password, row.password_hash)
    : await bcrypt.compare(password || "invalid-password", DUMMY_PASSWORD_HASH);
  if (!row || !valid)
    return res
      .status(401)
      .json({ status: "error", message: "Email or password is incorrect." });
  await regenerateSession(req);
  req.session.userId = row.id;
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  await saveSession(req);
  res.json({ user: publicUser(row) });
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
