export default function getHostname(c) {
  const host = c.req.header("Host");

  if (!host || /[/?#@\s]/.test(host)) return null;

  try {
    return new URL(`http://${host}`).hostname.toLowerCase().replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}
