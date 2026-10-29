import sharp from "sharp";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_SD_SHORT_SIDE = 480;

export async function validateSkinAnalysisImage(file) {

  if (!file?.buffer?.length) {
    throw createHttpError("Please upload an image.", 400);
  }

  if ((file.size ?? file.buffer.length) > MAX_FILE_SIZE_BYTES) {
    throw createHttpError("Image size must be 10 MB or less.", 400);
  }

  let metadata;

  try {
    metadata = await sharp(file.buffer, {
      limitInputPixels: 40_000_000,
    }).metadata();

  } catch {
    throw createHttpError("The uploaded file is not a valid image.", 400);
  }

  if (!["jpeg", "png"].includes(metadata.format)) {
    throw createHttpError("Only JPEG and PNG images are supported.", 400);
  }

  if (!metadata.width || !metadata.height) {
    throw createHttpError("Unable to determine image dimensions.", 400);
  }

  // EXIF orientation may rotate the image when displayed.
  const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation);

  const width = swapsDimensions ? metadata.height : metadata.width;

  const height = swapsDimensions ? metadata.width : metadata.height;

  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  if (shortSide < MIN_SD_SHORT_SIDE) {
    throw createHttpError(
      `This image is too small for SD skin analysis. The shortest side must be at least ${MIN_SD_SHORT_SIDE}px. Please upload a higher-resolution photo.`,
      400,
    );
  }

  return {
    width,
    height,
    format: metadata.format,
    mimeType: metadata.format === "jpeg" ? "image/jpeg" : "image/png",
    sizeBytes: file.size ?? file.buffer.length,
  };
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
