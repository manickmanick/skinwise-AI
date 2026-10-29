export function validate(schema, source = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      convert: true,
      stripUnknown: false,
    });
    if (error) {
      const errors = {};
      for (const detail of error.details) {
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
    if (source === "query") req.validatedQuery = value;
    else req[source] = value;
    next();
  };
}
