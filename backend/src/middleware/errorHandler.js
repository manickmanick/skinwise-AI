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

  if (error.isJoi) {
    const errors = {};
    for (const detail of error.details || []) {
      const field = detail.path.join(".") || "request";
      if (!errors[field]) errors[field] = detail.message.replaceAll('"', "");
    }
    return res.status(400).json({
      success: false,
      message: "Please correct the highlighted fields.",
      errors,
      code: "VALIDATION_ERROR",
    });
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "The request body must be valid JSON.",
      code: "INVALID_JSON",
    });
  }

  if (error instanceof Error && error.name === "MulterError") {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image size must be 10 MB or less."
        : "Image upload failed.";

    return res.status(400).json({
      success: false,
      status: "error",
      message,
      code: error.code || "INVALID_UPLOAD",
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
    success: false,
    status: "error",
    code: statusCode >= 500 ? "INTERNAL_ERROR" : error.code || "REQUEST_ERROR",
    message:
      statusCode < 500 ? error.message : publicServerError(error, req.id),
  });
}

function publicServerError(error, requestId) {
  let message = "Something went wrong on the server.";
  if (
    ["ECONNREFUSED", "EACCES", "PROTOCOL_CONNECTION_LOST"].includes(error.code)
  ) {
    message =
      "The database is not reachable. Check that MySQL is running and the backend .env connection settings are correct.";
  } else if (error.code === "ER_NO_SUCH_TABLE") {
    message =
      "The database tables are missing. Run npm run migrate from the backend folder.";
  } else if (error.code === "ER_BAD_FIELD_ERROR") {
    message =
      "The database schema is out of date. Run npm run migrate from the backend folder.";
  } else if (
    error.code === "SMTP_CONFIG_MISSING" ||
    error.code === "OTP_CONFIG_MISSING"
  ) {
    message =
      "Password recovery is not configured yet. Contact the site administrator.";
  } else if (error.code === "MAIL_DELIVERY_FAILED") {
    message =
      "We couldn't send a recovery email right now. Please try again later.";
  }
  return `${message} Reference: ${requestId}`;
}
