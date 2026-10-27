
export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof URIError) {
    return res.status(400).json({
      status: "error",
      message: "Invalid request URL.",
    });
  }

  if (error instanceof Error && error.name === "MulterError") {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image size must be 10 MB or less."
        : "Image upload failed.";

    return res.status(400).json({
      status: "error",
      message,
    });
  }

  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("[Backend Error]", error.message);
  }

  return res.status(statusCode).json({
    status: "error",
    message:
      statusCode < 500
        ? error.message
        : "An unexpected server error occurred.",
  });
}
