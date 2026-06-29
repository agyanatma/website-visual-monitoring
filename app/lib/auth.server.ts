import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "react-router";
import { getConfig } from "./config.server";

const COOKIE_NAME = "wvm_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(value: string) {
  return createHmac("sha256", getConfig().SESSION_SECRET).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function passwordHash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(username: string, password: string) {
  const config = getConfig();
  if (username !== config.ADMIN_USERNAME) return false;

  const expected = config.ADMIN_PASSWORD_HASH ?? (config.ADMIN_PASSWORD ? passwordHash(config.ADMIN_PASSWORD) : undefined);
  if (!expected) return false;

  return safeEqual(passwordHash(password), expected);
}

export function createSessionCookie() {
  const payload = JSON.stringify({ sub: "admin", exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = sign(encoded);
  return `${COOKIE_NAME}=${encoded}.${signature}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function isAuthenticated(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  const [encoded, signature] = match[1].split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(request: Request) {
  if (!isAuthenticated(request)) {
    throw redirect("/login");
  }
}
