export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizePageTitle(value) {
  if (typeof value !== "string") return null;

  return value.trim() || null;
}

export function isValidPagePath(path) {
  if (typeof path !== "string") return false;

  if (path === "/") return true;

  if (!/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(path)) {
    return false;
  }

  const segments = path.slice(1).split("/");

  return !["admin", "api", "public", "static", "uploads"].includes(segments[0]);
}
