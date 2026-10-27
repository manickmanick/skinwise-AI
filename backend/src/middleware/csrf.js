import { timingSafeEqual } from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
  if (origin && origin !== allowedOrigin) {
    return res
      .status(403)
      .json({ status: "error", message: "Request origin is not allowed." });
  }
  const supplied = req.get("x-csrf-token");
  const expected = req.session?.csrfToken;
  if (!supplied || !expected || supplied.length !== expected.length) {
    return res
      .status(403)
      .json({ status: "error", message: "Refresh the page and try again." });
  }
  if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res
      .status(403)
      .json({ status: "error", message: "Refresh the page and try again." });
  }
  next();
}
