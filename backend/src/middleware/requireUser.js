export function requireUser(req, res, next) {
  if (!req.session?.userId) {
    return res
      .status(401)
      .json({ status: "error", message: "Please sign in to continue." });
  }
  req.userId = req.session.userId;
  next();
}
