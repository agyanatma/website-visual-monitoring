import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import type { Browser } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { getConfig, type AppConfig } from "~/lib/config.server";
import { claimNextDueUrl, nextFutureSlot, updateCheckOutcome } from "~/db/monitored-urls.server";
import type { MonitoredUrl } from "~/db/schema";
import { OpenRouterVisualClassifier } from "./ai";
import { checkUrl } from "./checker";
import { DiscordAlertDispatcher } from "./discord";

chromium.use(stealth());

const workerId = `${os.hostname()}-${process.pid}-${Date.now()}`;

async function main() {
  const config = getConfig();
  const ai = new OpenRouterVisualClassifier(config);
  await ai.initialize();
  const discord = new DiscordAlertDispatcher(config);
  const browser = await chromium.launch({ headless: true });
  let active = 0;
  let stopping = false;

  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));

  console.log(`Worker ${workerId} started with max concurrency ${config.MAX_CONCURRENT_CHECKS}`);

  while (!stopping) {
    if (active >= config.MAX_CONCURRENT_CHECKS) {
      await delay(500);
      continue;
    }

    let due: MonitoredUrl | null;
    try {
      due = await claimNextDueUrl(workerId, config.CHECK_STALE_CLAIM_SECONDS);
    } catch (error) {
      console.error("Failed to claim next due URL; retrying worker loop", error);
      await delay(5_000);
      continue;
    }

    if (!due) {
      await delay(1_000);
      continue;
    }

    active += 1;
    void processUrl(due, config, ai, discord, browser)
      .catch((error) => console.error(`Check failed for ${due.url}`, error))
      .finally(() => {
        active -= 1;
      });
  }

  while (active > 0) await delay(250);
  await browser.close();
}

async function processUrl(
  monitoredUrl: MonitoredUrl,
  config: AppConfig,
  ai: OpenRouterVisualClassifier,
  discord: DiscordAlertDispatcher,
  browser: Browser,
) {
  const first = await checkUrl(browser, monitoredUrl.url, config, ai);
  let final = first;

  if (first.status === "FAILING") {
    await delay(config.CONFIRMATION_RETRY_DELAY_MS);
    final = await checkUrl(browser, monitoredUrl.url, config, ai);
    final.summary = `Attempt 1: ${first.failureCategory ?? "UNKNOWN"}. Retry: ${final.summary}`;
    final.signals = [...new Set([...first.signals, ...final.signals, "confirmation_retry"])] as string[];
  }

  const checkedAt = new Date();
  const nextCheckAt = nextFutureSlot(monitoredUrl.nextCheckAt, config.CHECK_CADENCE_MINUTES, checkedAt);
  let alertSentAt = monitoredUrl.alertSentAt;

  if (final.status === "FAILING" && !monitoredUrl.alertSentAt) {
    const sent = await discord.sendFailureAlert(monitoredUrl, final);
    alertSentAt = sent ? checkedAt : null;
  }

  await updateCheckOutcome({
    id: monitoredUrl.id,
    previous: monitoredUrl,
    status: final.status,
    failureCategory: final.failureCategory,
    summary: final.summary,
    signals: final.signals,
    httpStatus: final.httpStatus,
    finalUrl: final.finalUrl,
    durationMs: final.durationMs,
    aiClassification: final.aiClassification,
    aiConfidence: final.aiConfidence,
    checkedAt,
    nextCheckAt,
    alertSentAt,
  });

  console.log(`${monitoredUrl.url} -> ${final.status}${final.failureCategory ? `/${final.failureCategory}` : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
