import crypto from "node:crypto";

const PREFIX = "bcrypt-sha256-v1$";

function prehash(password) {
  return crypto
    .createHash("sha256")
    .update("SkinWise password v1\0")
    .update(password, "utf8")
    .digest("hex");
}

export async function hashPassword(password, bcrypt) {
  return `${PREFIX}${await bcrypt.hash(prehash(password), 12)}`;
}

export function verifyPassword(password, storedHash, bcrypt) {
  if (storedHash.startsWith(PREFIX))
    return bcrypt.compare(prehash(password), storedHash.slice(PREFIX.length));
  return bcrypt.compare(password, storedHash);
}
