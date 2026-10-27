import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const allowedTypes = new Set(["image/jpeg", "image/png"]);

    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error("Only JPEG and PNG images are supported.");
      error.statusCode = 400;
      return callback(error);
    }

    callback(null, true);
  },
});

export default uploadImage;
