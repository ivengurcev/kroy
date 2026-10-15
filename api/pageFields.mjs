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
  if (
    typeof path !== "string"
    || !path.startsWith("/")
    || /\s/.test(path)
    || path.includes("?")
    || path.includes("#")
  ) {
    return false;
  }

  if (path === "/") return true;

  const segments = path.slice(1).split("/");

  return segments.every((segment) => segment && segment !== "." && segment !== "..")
    && segments[0] !== "admin"
    && segments[0] !== "api";
}
