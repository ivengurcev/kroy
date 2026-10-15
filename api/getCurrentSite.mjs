import resolveCurrentSite from "./resolveCurrentSite.mjs";

export default async function getCurrentSite(c) {
  try {
    const site = await resolveCurrentSite(c);

    if (!site) {
      return c.json({ error: "Site not found" }, 404);
    }

    return site;
  } catch (error) {
    console.error("Failed to get current site", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
