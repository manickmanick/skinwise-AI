import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// Allow requests from our local frontend.
app.use(
  cors({
    origin: FRONTEND_URL,
  })
);

// Parse incoming JSON request bodies.
app.use(express.json());

// Basic server health endpoint.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    application: "SkinWise AI",
    message: "Backend is running",
  });
});

// Start the HTTP server.
app.listen(PORT, () => {
  console.log(`SkinWise AI backend: http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
});