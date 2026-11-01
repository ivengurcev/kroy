const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export default function isValidHostname(hostname) {
  if (
    typeof hostname !== "string"
    || hostname.length > 253
    || hostname !== hostname.toLowerCase()
  ) {
    return false;
  }

  const labels = hostname.split(".");

  return labels.length >= 2 && labels.every((label) => (
    label.length <= 63 && HOSTNAME_LABEL_PATTERN.test(label)
  ));
}
