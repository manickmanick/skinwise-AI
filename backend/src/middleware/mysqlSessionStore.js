import session from "express-session";
import { pool } from "../config/database.js";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class MySQLSessionStore extends session.Store {
  constructor({ ttl = DEFAULT_TTL_MS, cleanupIntervalMs = 15 * 60 * 1000 } = {}) {
    super();
    this.ttl = ttl;
    this.cleanupTimer = setInterval(() => {
      void pool.execute("DELETE FROM sessions WHERE expires_at <= ?", [Date.now()])
        .catch((error) => console.error(JSON.stringify({ level: "error", message: "Session cleanup failed", error: error.code || error.name || "InternalError" })));
    }, cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  get(sessionId, callback) {
    pool.execute("SELECT data, expires_at FROM sessions WHERE session_id = ?", [sessionId])
      .then(async ([rows]) => {
        const row = rows[0];
        if (!row) return callback(null, null);
        if (Number(row.expires_at) <= Date.now()) {
          await pool.execute("DELETE FROM sessions WHERE session_id = ?", [sessionId]);
          return callback(null, null);
        }
        try { callback(null, JSON.parse(row.data)); }
        catch (error) { callback(error); }
      })
      .catch(callback);
  }

  set(sessionId, data, callback = () => {}) {
    const expiresAt = sessionExpiry(data, this.ttl);
    pool.execute(
      `INSERT INTO sessions (session_id, expires_at, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), data = VALUES(data)`,
      [sessionId, expiresAt, JSON.stringify(data)],
    ).then(() => callback(null)).catch(callback);
  }

  touch(sessionId, data, callback = () => {}) {
    pool.execute("UPDATE sessions SET expires_at = ? WHERE session_id = ?", [sessionExpiry(data, this.ttl), sessionId])
      .then(() => callback(null)).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    pool.execute("DELETE FROM sessions WHERE session_id = ?", [sessionId])
      .then(() => callback(null)).catch(callback);
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}

function sessionExpiry(data, ttl) {
  const cookieExpiry = data?.cookie?.expires ? new Date(data.cookie.expires).getTime() : NaN;
  return Number.isFinite(cookieExpiry) ? cookieExpiry : Date.now() + ttl;
}
