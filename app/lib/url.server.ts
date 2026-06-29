import { createHash } from "node:crypto";

export function hashNormalizedUrl(normalizedUrl: string) {
  return createHash("sha256").update(normalizedUrl).digest("hex");
}
