import type { CompromiseFinding, CompromiseKind, CompromiseResult } from "~/db/schema";

export const COMPROMISE_RESULT_LABELS: Record<CompromiseResult, string> = {
  NOT_CHECKED: "Not checked",
  CLEAN: "Clean",
  SUSPICIOUS: "Suspicious",
  HACKED: "Hacked",
};

export const COMPROMISE_KIND_LABELS: Record<CompromiseKind, string> = {
  GAMBLING_SPAM: "Gambling spam",
  DEFACEMENT: "Defacement",
  REDIRECT: "Redirect",
  FOREIGN_SCRIPT: "Unknown script source",
  HIDDEN_IFRAME: "Hidden frame",
};

// Terms only gambling spam uses. They count as Compromise Evidence anywhere on the page,
// so they must never be words a legitimate article about gambling would use.
export const DEFAULT_SPAM_KEYWORDS = [
  "slot gacor",
  "gacor hari ini",
  "pola gacor",
  "slot88",
  "slot777",
  "maxwin",
  "situs toto",
  "toto togel",
  "rtp live",
  "rtp slot",
  "scatter hitam",
  "mahjong ways",
  "slot thailand",
  "akun pro thailand",
  "bocoran admin",
];

// General gambling terms. News and police sites use them openly, so they only count
// when they appear in a hidden link pointing to another site.
export const DEFAULT_GAMBLING_KEYWORDS = [
  "judi",
  "togel",
  "casino",
  "kasino",
  "poker",
  "sabung ayam",
  "slot online",
  "taruhan bola",
  "sbobet",
  "baccarat",
];

export const DEFAULT_DEFACEMENT_KEYWORDS = ["hacked by", "defaced by", "h4cked by", "h4ck3d by", "pwned by", "greetz to"];

/** The Compromise Status shown to users: an open Compromise Episode stays Hacked whatever the latest check saw. */
export function compromiseStatus(url: { compromiseStartedAt: Date | string | null; latestCompromiseResult: CompromiseResult }): CompromiseResult {
  return url.compromiseStartedAt ? "HACKED" : url.latestCompromiseResult;
}

export function formatCompromiseFinding(finding: CompromiseFinding) {
  return `${COMPROMISE_KIND_LABELS[finding.kind]}: ${finding.detail}`;
}

/** Keyword lists are stored as one entry per line (commas also accepted). */
export function parseKeywordList(value: string) {
  return [...new Set(value.split(/[\n,]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

export function resultOf(findings: CompromiseFinding[]): "CLEAN" | "SUSPICIOUS" | "HACKED" {
  if (findings.some((f) => f.level === "HACKED")) return "HACKED";
  return findings.length ? "SUSPICIOUS" : "CLEAN";
}
