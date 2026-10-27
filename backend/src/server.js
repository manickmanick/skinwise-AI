import dotenv from "dotenv";

dotenv.config();

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.SESSION_SECRET ||
    Buffer.byteLength(process.env.SESSION_SECRET) < 32)
) {
  throw new Error(
    "SESSION_SECRET must contain at least 32 bytes in production.",
  );
}

const { default: app } = await import("./app.js");

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`SkinWise AI backend: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Image validation: http://localhost:${PORT}/api/images/validate`);
  console.log(`Skin analysis: http://localhost:${PORT}/api/skin-analysis`);
});
