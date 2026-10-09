ALTER TABLE `monitored_urls`
  ADD COLUMN `latest_compromise_result` enum('NOT_CHECKED','CLEAN','SUSPICIOUS','HACKED') NOT NULL DEFAULT 'NOT_CHECKED' AFTER `latest_block_evidence`,
  ADD COLUMN `latest_compromise_findings` json NULL AFTER `latest_compromise_result`,
  ADD COLUMN `known_script_sources` json NULL AFTER `latest_compromise_findings`,
  ADD COLUMN `compromise_started_at` timestamp NULL AFTER `block_started_at`,
  ADD COLUMN `compromise_last_seen_at` timestamp NULL AFTER `compromise_started_at`,
  ADD COLUMN `compromise_evidence` json NULL AFTER `compromise_last_seen_at`,
  ADD COLUMN `compromise_alert_sent_at` timestamp NULL AFTER `compromise_evidence`;
