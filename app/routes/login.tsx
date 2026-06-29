import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/login";
import { createSessionCookie, isAuthenticated, verifyPassword } from "~/lib/auth.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Login · Website Visual Monitoring" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (isAuthenticated(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!verifyPassword(username, password)) {
    return { error: "Invalid username or password." };
  }

  throw redirect("/", {
    headers: { "Set-Cookie": createSessionCookie() },
  });
}

export default function Login() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">WVM</div>
        <p className="eyebrow">Private monitor</p>
        <h1>Sign in to watch the web.</h1>
        <p className="muted">Manage public URLs, check current status, and keep Discord alerts under control.</p>
        <Form method="post" className="form-stack">
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
          <button type="submit" className="primary-button">Sign in</button>
        </Form>
      </section>
    </main>
  );
}
