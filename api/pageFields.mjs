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

export function isValidRouteParameter(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
}

export function createDetailPath(listPath, parameter = "slug") {
  return `${listPath === "/" ? "" : listPath}/:${parameter}`;
}

export function isValidPageRoutePattern(path) {
  if (typeof path !== "string") return false;
  const match = path.match(/^(.*)\/:([A-Za-z][A-Za-z0-9_]*)$/);
  if (!match) return false;
  return match[1] === "" || isValidPagePath(match[1]);
}

export function routePatternsOverlap(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftSegments = left.split("/").filter(Boolean);
  const rightSegments = right.split("/").filter(Boolean);

  return leftSegments.length === rightSegments.length
    && leftSegments.every((segment, index) =>
      segment.startsWith(":")
      || rightSegments[index].startsWith(":")
      || segment === rightSegments[index]
    );
}

export function slugifyPageTitle(value) {
  const transliteration = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e",
    ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };

  return typeof value === "string"
    ? value.toLowerCase()
      .replace(/[а-яё]/g, (letter) => transliteration[letter])
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    : "";
}
