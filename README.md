# Website Visual Monitoring

Mobile-first website monitor for public client URLs. A separate worker uses Playwright/Chromium to check each URL roughly once per hour, detects clear failures with deterministic signals first, uses OpenRouter visual AI only for ambiguous cases, and sends one Discord alert per failure episode.

## Decisions captured

- Public URLs only; no authenticated flows.
- Mobile viewport by default: `390x844`.
- Screenshots are ephemeral and not stored.
- MySQL stores monitored URLs and latest result only.
- Dashboard and worker run as separate processes.
- Light Playwright stealth is enabled; no proxies or CAPTCHA solving.

See `CONTEXT.md` and `docs/adr/` for the domain language and architecture decisions.

## Setup

```bash
npm install
cp .env.example .env
```

Set at minimum:

```bash
DATABASE_URL=mysql://user:password@host:3306/database
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<sha256 password hash>
SESSION_SECRET=<32+ random chars>
DISCORD_WEBHOOK_URL=<discord webhook>
```

Generate a password hash:

```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" 'your-password'
```

Run migrations:

```bash
npm run db:migrate
```

Install Chromium for Playwright if needed:

```bash
npx playwright install chromium
```

## Development

Run the dashboard:

```bash
npm run dev
```

Run the monitoring worker in another terminal:

```bash
npm run dev:worker
```

## Production commands

```bash
npm run build
npm run start
npm run worker
```

Run dashboard and worker as separate processes/services.

## CSV import

CSV format:

```csv
name,url,enabled
Client A,https://example.com,true
Client B,https://example.org,false
```

Duplicate URLs are skipped after light normalization.
