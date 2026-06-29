export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  const parsed = new URL(trimmed);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL must start with http:// or https://");
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";

  if (parsed.pathname === "/") {
    parsed.pathname = "/";
  }

  return parsed.toString();
}

export function hostnameForDisplay(rawUrl: string) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}
