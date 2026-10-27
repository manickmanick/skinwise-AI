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
    console.error(
      JSON.stringify({
        level: "error",
        requestId: req.id,
        statusCode,
        path: req.path,
        error: error.code || error.name || "InternalError",
      }),
    );
  }

  return res.status(statusCode).json({
    status: "error",
    message: statusCode < 500 ? error.message : publicServerError(error, req.id),
  });
}

function publicServerError(error, requestId) {
  let message = "Something went wrong on the server.";
  if (["ECONNREFUSED", "EACCES", "PROTOCOL_CONNECTION_LOST"].includes(error.code)) {
    message = "The database is not reachable. Check that MySQL is running and the backend .env connection settings are correct.";
  } else if (error.code === "ER_NO_SUCH_TABLE") {
    message = "The database tables are missing. Run npm run migrate from the backend folder.";
  } else if (error.code === "ER_BAD_FIELD_ERROR") {
    message = "The database schema is out of date. Run npm run migrate from the backend folder.";
  }
  return `${message} Reference: ${requestId}`;
}
