// Uploaded SVG stays vector. Its document cannot execute scripts or load remote resources.
export const SVG_CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
