import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pool } from "./config/database.js";
import { requireCsrf } from "./middleware/csrf.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireUser } from "./middleware/requireUser.js";
import { MySQLSessionStore } from "./middleware/mysqlSessionStore.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import routineRoutes from "./routes/routineRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import environmentRoutes from "./routes/environmentRoutes.js";
import imageValidationRoutes from "./routes/imageValidationRoutes.js";



const app = express();
const sessionStore = new MySQLSessionStore();
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";


app.disable("x-powered-by");
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(
  session({
    name: "skinwise.sid",
    secret:
      process.env.SESSION_SECRET ||
      "development-only-change-this-session-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health", (_req, res) =>
  res.status(200).json({
    status: "ok",
    application: "SkinWise AI",
    message: "Backend is running",
  }),
);
app.get("/api/health/ready", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ready" });
  } catch (error) {
    next(error);
  }
});
app.get("/api/auth/csrf", (req, res) => {
  req.session.csrfToken ??= crypto.randomBytes(32).toString("hex");
  res.json({ csrfToken: req.session.csrfToken });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      status: "error",
      message: "Too many sign-in attempts. Wait a little and try again.",
      code: "RATE_LIMITED",
    }),
});
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth", requireCsrf, authRoutes);
app.use("/api/skin-analyses", requireCsrf, analysisRoutes);
app.use("/api/skin-analysis", requireCsrf, analysisRoutes);
app.use("/api/images", imageValidationRoutes);
app.use("/api/skin-profile", requireUser, requireCsrf, profileRoutes);
app.use("/api/routine", requireUser, requireCsrf, routineRoutes);
app.use("/api/progress", requireUser, progressRoutes);
app.use("/api/environment", requireUser, environmentRoutes);

app.use((_req, res) =>
  res.status(404).json({
    success: false,
    status: "error",
    message: "Not found.",
    code: "NOT_FOUND",
  }),
);
app.use(errorHandler);

export default app;
