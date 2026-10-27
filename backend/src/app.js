
import express from "express";
import cors from "cors";

import imageRoutes from "./routes/imageRoutes.js";
import skinAnalysisRoutes from "./routes/skinAnalysisRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    application: "SkinWise AI",
    message: "Backend is running",
  });
});

app.use("/api/images", imageRoutes);
app.use("/api/skin-analysis", skinAnalysisRoutes);

app.use(errorHandler);

export default app;
