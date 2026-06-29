import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireAdmin } from "~/lib/auth.server";
import { getConfig } from "~/lib/config.server";
import {
  createMonitoredUrl,
  deleteMonitoredUrl,
  importMonitoredUrlsCsv,
  listMonitoredUrls,
  setMonitoredUrlEnabled,
  updateMonitoredUrl,
} from "~/db/monitored-urls.server";
import { hostnameForDisplay } from "~/lib/url";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Website Visual Monitoring" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAdmin(request);
  const urls = await listMonitoredUrls();
  return {
    urls,
    cadenceMinutes: getConfig().CHECK_CADENCE_MINUTES,
  };
}

export async function action({ request }: Route.ActionArgs) {
  requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "add") {
      await createMonitoredUrl({
        name: String(formData.get("name") ?? ""),
        url: String(formData.get("url") ?? ""),
        enabled: formData.get("enabled") === "on",
      });
      return { ok: true, message: "Monitored URL added." };
    }

    if (intent === "update") {
      await updateMonitoredUrl({
        id: Number(formData.get("id")),
        name: String(formData.get("name") ?? ""),
        url: String(formData.get("url") ?? ""),
        enabled: formData.get("enabled") === "on",
      });
      return { ok: true, message: "Monitored URL updated." };
    }

    if (intent === "toggle") {
      await setMonitoredUrlEnabled(Number(formData.get("id")), formData.get("enabled") !== "true");
      return { ok: true, message: "Monitoring state changed." };
    }

    if (intent === "delete") {
      await deleteMonitoredUrl(Number(formData.get("id")));
      return { ok: true, message: "Monitored URL deleted." };
    }

    if (intent === "import") {
      const file = formData.get("csv");
      const csv = file instanceof File ? await file.text() : String(formData.get("csvText") ?? "");
      const result = await importMonitoredUrlsCsv(csv, getConfig().CHECK_CADENCE_MINUTES);
      return {
        ok: true,
        message: `Imported ${result.imported}. Skipped duplicates ${result.skippedDuplicates}. Invalid ${result.invalid}.`,
      };
    }

    return { ok: false, message: "Unknown action." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Action failed." };
  }
}

export default function Dashboard() {
  const { urls, cadenceMinutes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const failing = urls.filter((url) => url.latestStatus === "FAILING").length;
  const ok = urls.filter((url) => url.latestStatus === "OK").length;
  const unknown = urls.filter((url) => url.latestStatus === "UNKNOWN").length;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Website Visual Monitoring</p>
          <h1>Mobile-first checks for public client pages.</h1>
        </div>
        <Form method="post" action="/logout">
          <button className="ghost-button" type="submit">Sign out</button>
        </Form>
      </header>

      <section className="status-grid" aria-label="Monitoring summary">
        <Metric label="Monitored URLs" value={urls.length} />
        <Metric label="OK" value={ok} tone="ok" />
        <Metric label="Failing" value={failing} tone="bad" />
        <Metric label="Unknown" value={unknown} />
        <Metric label="Cadence" value={`${cadenceMinutes}m`} />
      </section>

      {actionData?.message ? (
        <div className={actionData.ok ? "notice" : "notice error"}>{actionData.message}</div>
      ) : null}

      <section className="panel two-column">
        <div>
          <h2>Add a monitored URL</h2>
          <p className="muted">Use public URLs only. Checks run in the default mobile viewport.</p>
          <Form method="post" className="compact-form">
            <input type="hidden" name="intent" value="add" />
            <label>Name<input name="name" placeholder="Client homepage" required /></label>
            <label>URL<input name="url" placeholder="https://example.com" type="url" required /></label>
            <label className="check-row"><input name="enabled" type="checkbox" defaultChecked /> Enabled</label>
            <button className="primary-button" type="submit">Add URL</button>
          </Form>
        </div>
        <div>
          <h2>CSV import</h2>
          <p className="muted">Columns: <code>name,url,enabled</code>. Duplicate URLs are skipped.</p>
          <Form method="post" encType="multipart/form-data" className="compact-form">
            <input type="hidden" name="intent" value="import" />
            <input name="csv" type="file" accept=".csv,text/csv" />
            <button className="secondary-button" type="submit">Import CSV</button>
          </Form>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="section-heading">
          <h2>Latest status</h2>
          <p className="muted">No screenshots are stored. Alerts are sent once per failure episode.</p>
        </div>
        <div className="url-table">
          {urls.length === 0 ? <p className="empty-state">Add or import URLs to start monitoring.</p> : null}
          {urls.map((url) => (
            <article className="url-row" key={url.id}>
              <Form method="post" className="url-edit-form">
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={url.id} />
                <div className="url-main">
                  <input name="name" defaultValue={url.name} aria-label="Name" />
                  <input name="url" defaultValue={url.url} aria-label="URL" />
                  <p className="muted small">{hostnameForDisplay(url.latestFinalUrl ?? url.url)}</p>
                </div>
                <div className="status-stack">
                  <span className={`status-pill ${url.latestStatus.toLowerCase()}`}>{url.latestStatus}</span>
                  {url.latestFailureCategory ? <span className="category-pill">{url.latestFailureCategory}</span> : null}
                  <span className="muted small">{formatDate(url.latestCheckedAt)}</span>
                </div>
                <div className="summary-cell">
                  <p>{url.latestSummary ?? "No check completed yet."}</p>
                  {url.latestSignals?.length ? <p className="muted small">Signals: {url.latestSignals.join(", ")}</p> : null}
                </div>
                <label className="check-row"><input name="enabled" type="checkbox" defaultChecked={url.enabled} /> Enabled</label>
                <button className="secondary-button" type="submit">Save</button>
              </Form>
              <div className="row-actions">
                <Form method="post">
                  <input type="hidden" name="intent" value="toggle" />
                  <input type="hidden" name="id" value={url.id} />
                  <input type="hidden" name="enabled" value={String(url.enabled)} />
                  <button className="ghost-button" type="submit">{url.enabled ? "Disable" : "Enable"}</button>
                </Form>
                <Form method="post" onSubmit={(event) => !confirm("Delete this monitored URL?") && event.preventDefault()}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={url.id} />
                  <button className="danger-button" type="submit">Delete</button>
                </Form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "bad" }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(value: Date | string | null) {
  if (!value) return "Never checked";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
