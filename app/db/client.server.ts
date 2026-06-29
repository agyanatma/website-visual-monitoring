import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let pool: mysql.Pool | undefined;

const transientDatabaseErrorCodes = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_SEQUENCE_TIMEOUT",
  "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT",
]);

export function getPool() {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }

    pool = mysql.createPool({
      uri: databaseUrl,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
      timezone: "Z",
      multipleStatements: false,
      enableKeepAlive: true,
      keepAliveInitialDelay: Number(process.env.DB_KEEP_ALIVE_INITIAL_DELAY_MS ?? 0),
    });
  }

  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: "default" });
}

export async function withDbRetry<T>(operation: () => Promise<T>, options: { attempts?: number; label?: string } = {}) {
  const attempts = options.attempts ?? Number(process.env.DB_RETRY_ATTEMPTS ?? 3);
  const baseDelayMs = Number(process.env.DB_RETRY_BASE_DELAY_MS ?? 250);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const attemptPool = getPool();
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientDatabaseError(error)) break;

      await resetPool(attemptPool);
      const waitMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `Transient database error${options.label ? ` during ${options.label}` : ""}; retrying in ${waitMs}ms (${attempt}/${attempts})`,
        summarizeDatabaseError(error),
      );
      await delay(waitMs);
    }
  }

  throw lastError;
}

export function isTransientDatabaseError(error: unknown): boolean {
  for (const item of errorChain(error)) {
    const candidate = item as { code?: unknown; errno?: unknown; fatal?: unknown; message?: unknown };
    if (typeof candidate.code === "string" && transientDatabaseErrorCodes.has(candidate.code)) return true;
    if (candidate.fatal === true) return true;
    if (typeof candidate.errno === "number" && [-60, 1205, 1213].includes(candidate.errno)) return true;
    if (typeof candidate.message === "string" && /closed state|connection lost|read ETIMEDOUT/i.test(candidate.message)) return true;
  }
  return false;
}

export async function resetPool(poolToReset = pool) {
  if (!poolToReset) return;
  if (pool === poolToReset) pool = undefined;
  try {
    await poolToReset.end();
  } catch {
    // The connection is already broken; there is nothing else to clean up.
  }
}

function* errorChain(error: unknown): Generator<unknown> {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    yield current;
    current = (current as { cause?: unknown }).cause;
  }
}

function summarizeDatabaseError(error: unknown) {
  for (const item of errorChain(error)) {
    const candidate = item as { code?: unknown; errno?: unknown; message?: unknown };
    if (candidate.code || candidate.errno || candidate.message) {
      return {
        code: candidate.code,
        errno: candidate.errno,
        message: candidate.message,
      };
    }
  }
  return error;
}
