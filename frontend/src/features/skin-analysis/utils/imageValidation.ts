const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return "Choose a JPEG or PNG image.";
  if (file.size === 0) return "This image file is empty. Choose another image.";
  if (file.size > MAX_FILE_SIZE) return "Image size must be 10 MB or less.";
  return null;
}
